# Cadastro e checkout da LsBarber

## Testar agora, sem contas externas

Execute `npm install` e `npm run dev`. Abra `/apresentacao#planos` e escolha um plano.
Também pode abrir `/cadastro?plano=plus&ciclo=annual` diretamente.

O modo padrão é demonstração (`VITE_BILLING_ENABLED=false`, inclusive se omitido).
Use nome, e-mail e senha fictícios. A senha é validada em memória e nunca salva em
localStorage/sessionStorage. Os demais dados ficam em sessionStorage somente nesta
aba. O botão “Simular pagamento” cria um recibo demonstrativo com validade de 1 hora.
Ele não cria usuário, assinatura, cliente Stripe, cobrança nem altera o painel local.
Um link de confirmação sem recibo não mostra sucesso.

Rotas públicas:
- `/cadastro?plano=basico|plus|pro&ciclo=monthly|annual`
- `/checkout?plano=...&ciclo=...`
- `/confirmacao?plano=...&ciclo=...`

Seleção inválida cai em Plus mensal. Alterações de plano no checkout atualizam a URL.

## Ativar Supabase Auth e Stripe em sandbox depois

1. Crie um projeto Supabase e habilite Email/Password em Auth. Mantenha confirmação
   de e-mail habilitada. Defina Site URL e permita o retorno `http://localhost:5173/checkout**`
   durante testes (depois substitua por seu domínio HTTPS).
2. Execute **somente `supabase/billing.sql`** no SQL Editor para as tabelas de cobrança.
   É um script aditivo. Não execute o `schema.sql` legado para configurar cobrança:
   ele contém a remoção da tabela antiga Novo Stilo.
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
   supabase functions deploy billing
   supabase functions deploy stripe-webhook
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
   `billing_customers`/`billing_subscriptions`. Nenhuma transação real foi executada no desenvolvimento.

## Comportamento real preparado

- Cadastro e entrada: Supabase Auth, metadados de nome/barbearia/telefone associados ao usuário.
- Pagamento: Stripe Checkout hospedado, assinatura recorrente por cartão.
- O navegador envia só plano e ciclo; IDs de preços e totais vêm do servidor.
- Lock por usuário no banco serializa criação, sessão aberta é reutilizada e assinatura
  existente impede outra compra. Idempotency keys protegem retries na Stripe.
- Confirmação consulta a sessão na Stripe e confere o proprietário. Parâmetros da URL
  e recibos demonstrativos não concedem assinatura.
- Webhook assinado persiste o estado atual da assinatura; falhas de banco retornam 500
  para a Stripe repetir. Upsert atômico ignora eventos mais antigos e tolera duplicatas.
- Clientes só leem sua própria cobrança; escrita é exclusiva das funções service-role.
- Segredos live são bloqueados até definir explicitamente `ALLOW_LIVE_PAYMENTS=true`.

## Limite desta entrega antes de comercializar

Esta entrega prepara **cadastro e contratação**, não converte o painel legado em um SaaS
multiempresa. O painel ainda tem armazenamento local/registro Supabase compartilhado,
sem login obrigatório ou aplicação dos limites de profissionais. Por isso a confirmação
real não libera um painel compartilhado automaticamente. Antes de habilitar cobranças
reais, conecte assinatura a um workspace isolado por conta, proteja rotas e políticas de
dados, aplique limites, defina termos/privacidade e disponibilize gestão/cancelamento
de assinatura. Até lá, mantenha Stripe em sandbox e `ALLOW_LIVE_PAYMENTS=false`.

## Verificações executáveis

```sh
npm run build
npm run typecheck
npm run verify:purchase
npm run verify:purchase:integration
npm run verify:marketing
```

Os testes de navegador requerem Vite na porta 5173 e Microsoft Edge. Evidências em
`artifacts/purchase/`. Dentro de `supabase/functions`, execute `deno task check` e
`deno task test` (ou `npx --yes deno task ...`). Os testes das funções interceptam HTTP:
não enviam pedidos à Stripe ou ao Supabase. A aplicação do SQL e a integração real
dependem da configuração das contas pelo proprietário.

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
