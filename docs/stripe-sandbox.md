# Configuração Stripe da LsBarber

Catálogo criado e conferido no Dashboard em 25/09/2026, na **Área restrita de
Lshub**, conta `acct_1UEP76Qqy9vpGMZY`, modo **teste**. Nenhuma cobrança real foi executada.

| Plano | Produto | Mensal BRL | Anual BRL |
| --- | --- | --- | --- |
| Básico | `prod_VKIqUkESoN6eIs` | 39,90 | 399,00 |
| Plus | `prod_VKIrbYwzsWzmVm` | 69,90 | 699,00 |
| Pro | `prod_VKIsF50HJECxiE` | 99,90 | 999,00 |

| Variável de servidor | ID do preço recorrente |
| --- | --- |
| `STRIPE_PRICE_BASICO_MONTHLY` | `price_1UJeF1Qqy9vpGMZYrZR4koOh` |
| `STRIPE_PRICE_BASICO_ANNUAL` | `price_1UJeFgQqy9vpGMZYzgpkUv2n` |
| `STRIPE_PRICE_PLUS_MONTHLY` | `price_1UJeFzQqy9vpGMZYk0N1NQQh` |
| `STRIPE_PRICE_PLUS_ANNUAL` | `price_1UJeGNQqy9vpGMZYj3nAarCE` |
| `STRIPE_PRICE_PRO_MONTHLY` | `price_1UJeGaQqy9vpGMZYHVbdtxM3` |
| `STRIPE_PRICE_PRO_ANNUAL` | `price_1UJeH2Qqy9vpGMZYxriY9llJ` |

Os preços mensais são os padrões dos produtos. Os anuais cobram o total uma vez
por ano, não em parcelas. Os valores coincidem com `src/lib/plans.ts` e o catálogo
do servidor. Os produtos descrevem os limites de 1, 3 e 8 profissionais.

## Estado da integração local

Em 25/09/2026, o checkout de teste foi conectado ao projeto Supabase
`zsmlavmpimlukuipnplx` (LsBarber). O SQL aditivo `supabase/billing.sql` foi
aplicado sem alterar as tabelas legadas. Auth por e-mail está habilitado com
confirmação obrigatória e o retorno `http://localhost:5173/checkout*` foi
permitido. As funções `billing` e `stripe-webhook` estão publicadas; o destino
Stripe `we_1UJiwIQqy9vpGMZYL1Y1ODqD` está ativo, com os cinco eventos
listados em `docs/checkout.md`. Os seis IDs de preços, `STRIPE_SECRET_KEY` e
`STRIPE_WEBHOOK_SECRET` estão nos secrets do Supabase; as duas chaves secretas
não foram gravadas no repositório. `.env.local` contém somente URL/chave pública
do Supabase e `VITE_BILLING_ENABLED=true` para o Vite local.

As funções foram verificadas em execução: uma chamada sem autenticação ao
`billing` retorna 401 e uma chamada sem assinatura ao webhook retorna 400.

Em 26/09/2026 UTC, o fluxo ponta a ponta passou com e-mail confirmado e cartão
fictício da Stripe: cadastro/login, criação da sessão, pagamento de teste,
retorno para `/confirmacao` com “Pagamento confirmado”, webhook e persistência.
Na Stripe, a assinatura `sub_1UJjWTQqy9vpGMZYGgilP7oI` ficou **ativa** no plano
Pro mensal e o pagamento de teste de R$ 99,90 ficou **OK**. O destino
`we_1UJiwIQqy9vpGMZYL1Y1ODqD` recebeu `checkout.session.completed` e
`customer.subscription.created`, ambos com HTTP 200. No Supabase,
`billing_subscriptions` contém essa assinatura para o usuário confirmado, com
`plan=pro`, `cycle=monthly` e `status=active`. Não houve cobrança real.
Ela está marcada `livemode=false` e não concederá acesso quando o projeto
for alterado para modo live.

Ainda não foram validados no provedor os cenários de cartão recusado, 3DS e
renovação/cancelamento da assinatura. A Stripe exibe “Área restrita de Lshub”
como nome do vendedor no Checkout; ajustar a marca pública da conta antes de
comercializar, se ela for dedicada à LsBarber.

Em 26/09/2026, `supabase/commercial.sql` foi aplicado: tabela privada por
proprietário, limite do plano no banco e retirada dos grants públicos das tabelas
antigas. A consulta de privilégios não encontrou nenhuma tabela `public` legível
por `anon`; o teste `supabase/tests/commercial_rls.sql` passou e não deixou linha
de teste no banco. A função
`billing` foi republicada com criação de sessão do portal da Stripe. A interface
nova ainda precisa de validação visual em navegador e o portal precisa ser
testado de ponta a ponta. No painel de testes, histórico de faturas,
atualização de cartão e cancelamento ao fim do período aparecem habilitados;
alternância de planos está desabilitada. O portal ainda exibe “Lshub”, sem
links próprios de Termos ou Privacidade. A Stripe informa que nenhum dado
comercial foi adicionado e pede ativação dos produtos para cadastrá-los.

Em 26/09/2026, após conferir IDs e contagens, os quatro registros antigos
de maio em `clients`, `professionals`, `services` e `settings` foram excluídos
com `supabase/cleanup_legacy_2026_09_26.sql`. A tabela vazia
`novo_stilo_state` foi removida com `supabase/drop_empty_novo_stilo_state_2026_09_26.sql`.
Uma consulta posterior confirmou zero linhas nas tabelas operacionais antigas;
o cliente e a assinatura Stripe de teste permaneceram (um registro em cada
tabela). Esses dois scripts são de execução única e não devem ser repetidos.
O `supabase/commercial.sql` foi reaplicado para retirar também as políticas RLS
de leitura/escrita das tabelas antigas, mantendo-as sem grants para `anon` e
`authenticated`. Os testes transacionais de RLS e modo de cobrança passaram
após a alteração. O auditor do banco passou de nove avisos para apenas um:
proteção contra senhas vazadas desativada no Auth.

O webhook agora identifica o plano pelo preço recorrente atual em
`subscription.items`, sem depender dos metadados do checkout inicial.
Alterações para preços não cadastrados ou assinaturas com múltiplos itens
suspendem o acesso em vez de manter um limite antigo. A lógica passou em
testes simulados e foi publicada, mas a troca de plano no portal ainda não
foi testada com um evento real.

`APP_URL` no Supabase aponta para `http://localhost:5173`, portanto a Stripe só
consegue devolver o usuário ao aplicativo enquanto o Vite estiver rodando neste
computador. Para testar um site publicado, altere `APP_URL` para o domínio HTTPS,
configure o redirect de Auth correspondente e as variáveis públicas no host.

O banco permanece em `billing_environment.live_mode=false`: 1 assinatura de
teste e nenhuma assinatura live na consulta de 26/09/2026. As funções billing
e stripe-webhook foram republicadas para separar clientes e assinaturas por
modo; sem autenticação billing retorna 401, e webhook sem assinatura retorna
400. O teste transacional confirmou que a assinatura de teste não libera o
workspace quando o modo live é ativado temporariamente na mesma transação. O
teste `supabase/tests/billing_mode.sql` confirmou dois clientes Stripe separados
para a mesma conta e leitura restrita ao proprietário; terminou com rollback.

Não reutilizar estes IDs em outra conta Stripe nem em produção. Não colocar
chaves secretas em arquivos públicos, variáveis `VITE_*`, documentação ou chat.
Manter `ALLOW_LIVE_PAYMENTS=false`; os bloqueios de comercialização descritos em
`docs/checkout.md` continuam válidos.
