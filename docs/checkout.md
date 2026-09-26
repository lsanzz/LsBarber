# Cadastro e checkout da LsBarber

## Testar agora, sem contas externas

Execute `npm install` e `npm run dev`. Abra `/apresentacao#planos` e escolha um plano.
Também pode abrir `/cadastro?plano=plus&ciclo=annual` diretamente.

No servidor de desenvolvimento, o modo padrão é demonstração quando
`VITE_BILLING_ENABLED` está ausente ou `false`. Builds de produção sempre exigem
autenticação e cobrança configuradas: sem isso, o painel permanece bloqueado.
Use nome, e-mail e senha fictícios. A senha é validada em memória e nunca salva em
localStorage/sessionStorage. Os demais dados ficam em sessionStorage somente nesta
aba. O botão “Simular pagamento” cria um recibo demonstrativo com validade de 1 hora.
Ele não cria usuário, assinatura, cliente Stripe, cobrança nem altera o painel local.
Um link de confirmação sem recibo não mostra sucesso.

Rotas públicas:
- `/cadastro?plano=basico|plus|pro&ciclo=monthly|annual`
- `/checkout?plano=...&ciclo=...`
- `/checkout?recuperacao=1` (retorno do link de redefinição de senha)
- `/confirmacao?plano=...&ciclo=...`

Seleção inválida cai em Plus mensal. Alterações de plano no checkout atualizam a URL.

## Configuração Supabase Auth e Stripe em sandbox

O ambiente local já está configurado no projeto `zsmlavmpimlukuipnplx`;
consulte `docs/stripe-sandbox.md` para o estado atual. Os passos abaixo servem
para reproduzir a configuração em outro projeto ou migrá-la para um domínio.

1. Crie um projeto Supabase e habilite Email/Password em Auth. Mantenha confirmação
   de e-mail habilitada. Defina Site URL e permita o retorno `http://localhost:5173/checkout*`
   durante testes (depois substitua por seu domínio HTTPS). Este retorno também é
   usado em `/checkout?recuperacao=1` para redefinir senhas. Configure SMTP próprio
   antes de abrir cadastros ao público; o envio padrão não se destina ao uso em produção.
2. Execute `supabase/billing.sql` e depois `supabase/commercial.sql` no SQL Editor.
   Ambos são aditivos e preservam os dados antigos. `schema.sql` é um aviso
   obsoleto, sem comandos de criação ou exclusão.
3. Crie três produtos na Stripe e dois preços recorrentes em BRL para cada um:

   | Produto | Mensal (interval=month) | Anual (interval=year) |
   | --- | --- | --- |
   | Básico | R$39,90 | R$399,00 |
   | Plus | R$69,90 | R$699,00 |
   | Pro | R$99,90 | R$999,00 |

   O total anual é pago uma vez por ano; não é parcelamento mensal. Use interval_count=1.
   Os valores são conferidos no servidor contra o catálogo; configurar um preço incorreto
   bloqueia a criação da sessão. Não ative tributos/adicionais que contradigam os totais exibidos.
4. Configure os secrets das Edge Functions usando `supabase/.env.example` como guia.
   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são disponibilizados nas funções hospedadas.
   `APP_URL` é a origem exata, sem caminho (ex.: `http://localhost:5173`). A origem gera
   as URLs de retorno e controla CORS. Nunca coloque chave secreta Stripe ou service-role em VITE_*.
5. Com o CLI Supabase instalado e vinculado ao projeto:

   ```sh
   supabase functions deploy billing --no-verify-jwt
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

   `supabase/config.toml` desativa a validação JWT do gateway. A função billing verifica
   o token por `auth.getUser`; o webhook verifica a assinatura Stripe sobre o corpo bruto.
6. Na Stripe, adicione o endpoint
   `https://SEU-PROJETO.supabase.co/functions/v1/stripe-webhook` e os eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copie o `whsec_...` para `STRIPE_WEBHOOK_SECRET`.
7. Crie `.env.local` com os valores públicos do projeto e `VITE_BILLING_ENABLED=true`.
   Reinicie o Vite. Cadastre, confirme o e-mail e entre na conta para prosseguir.
8. Teste no ambiente de teste da Stripe com cartões de teste oficiais, incluindo
   recusa e autenticação 3DS. Confirme os eventos no dashboard e as linhas em
   `billing_customers`/`billing_subscriptions`. O caminho de cartão aprovado
   passou por esse teste ponta a ponta em sandbox; recusa, 3DS e renovação ainda
   precisam de validação. Nenhuma transação real foi executada.

## Comportamento real preparado

- Cadastro e entrada: Supabase Auth, metadados de nome/barbearia/telefone associados ao usuário.
- Recuperação de senha: solicitação sem revelar se o e-mail existe, link para uma
  página pública de nova senha e novo login depois da troca.
- Pagamento: Stripe Checkout hospedado, assinatura recorrente por cartão.
- O navegador envia só plano e ciclo; IDs de preços e totais vêm do servidor.
- Lock por usuário no banco serializa criação, sessão aberta é reutilizada e assinatura
  existente impede outra compra. Idempotency keys protegem retries na Stripe.
- Confirmação consulta a sessão na Stripe e confere o proprietário. Parâmetros da URL
  e recibos demonstrativos não concedem assinatura.
- Webhook assinado persiste o estado atual da assinatura; falhas de banco retornam 500
  para a Stripe repetir. Upsert atômico ignora eventos mais antigos e tolera duplicatas.
- Clientes só leem sua própria cobrança; escrita é exclusiva das funções service-role.
- Clientes, preços e assinaturas de teste e live são separados. O modo ativo é
  definido no banco em `billing_environment`; a função recusa uma chave Stripe
  de modo diferente, e uma assinatura de teste não libera o painel em modo live.
- O painel comercial exige conta confirmada e assinatura ativa. Cada usuário lê seu
  próprio espaço `salon_workspaces` com RLS; o banco valida o limite de profissionais
  e impede gravações concorrentes que sobrescreveriam outra aba.
- O proprietário pode baixar uma cópia JSON dos dados, inclusive depois de encerrar
  a assinatura; cartão, faturas e cancelamento ficam no portal da Stripe.
- Segredos live são bloqueados até definir explicitamente `ALLOW_LIVE_PAYMENTS=true`.
  Mesmo depois disso, o checkout live permanece restrito a `LIVE_TEST_USER_ID`
  enquanto `LIVE_CHECKOUT_AUDIENCE=restricted`; sem audiência configurada, falha
  fechado. Só `LIVE_CHECKOUT_AUDIENCE=public` abre a criação de checkout a todas
  as contas confirmadas.
- `billing.sql` inicia em `live_mode=false`. Na virada controlada para produção,
  após configurar domínio HTTPS, chave e webhook live, atualizar a única linha
  de `billing_environment` para `live_mode=true`. Essa mudança invalida o acesso
  de assinaturas de teste; ela não deve ser feita antes da validação do ambiente.

## Limites antes de comercializar

O isolamento por proprietário, bloqueio de acesso e limite foram implementados,
mas **isso ainda não autoriza pagamentos reais**. Faltam domínio e hospedagem HTTPS,
identidade empresarial e textos legais revisados, conta Stripe live com preços e
portal configurados, e testes ponta a ponta em produção. A configuração da sandbox
ainda aponta para localhost. Veja `docs/commercial-readiness.md` para a lista de
pendências e evidências. Mantenha `ALLOW_LIVE_PAYMENTS=false` até a janela de
teste live controlado; siga a ordem de `docs/commercial-readiness.md`.

## Verificações executáveis

```sh
npm run build
npm run typecheck
npm run verify:purchase
npm run verify:purchase:integration
npm run verify:marketing
```

Os testes de navegador iniciam Vite em portas temporárias e requerem Microsoft Edge. Evidências em
`artifacts/purchase/`. Dentro de `supabase/functions`, execute `deno task check` e
`deno task test` (ou `npx --yes deno task ...`). Os testes das funções interceptam HTTP:
não enviam pedidos à Stripe ou ao Supabase. O SQL e as funções foram aplicados
ao projeto LsBarber. O fluxo com conta de e-mail confirmada e pagamento de teste
foi validado; evidências do provedor e do banco estão em `docs/stripe-sandbox.md`.
O isolamento do banco é testado com `supabase/tests/commercial_rls.sql` em transação
com rollback; o teste requer uma conta com plano ativo e outra conta Auth. A
separação dos clientes Stripe é testada em `supabase/tests/billing_mode.sql`,
também com rollback.

`verify:purchase:integration` inicia temporariamente o Vite na porta 5181 com
configuração fictícia e intercepta todas as requisições de autenticação e cobrança.
Valida confirmação por e-mail, login, erro/retry, redirecionamento externo e consulta
do status sem criar contas ou cobranças nos provedores.

Referências oficiais:
- https://docs.stripe.com/payments/checkout/build-subscriptions
- https://docs.stripe.com/webhooks
- https://supabase.com/docs/guides/functions/examples/stripe-webhooks
- https://supabase.com/docs/reference/javascript/auth-signup

Design: continuidade da identidade preta/dourada existente; etapas explícitas, resumo
persistente, formulários com labels/erros, sem cartão falso. Refero/craft-details orienta
foco, validação e adaptação móvel; os seletores reaproveitam Motion/Transitions.dev.
