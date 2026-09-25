# Configuração Stripe da LsBarber

Catálogo criado e conferido no Dashboard em 25/09/2026, na **Área restrita de
Lshub**, conta `acct_1UEP76Qqy9vpGMZY`, modo **teste**. Nenhum pagamento executado.

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

## Próxima etapa obrigatória

O checkout ainda **não está conectado**. Não há `.env.local` com Supabase no
projeto e as funções ainda não foram publicadas nesta configuração.

1. Selecionar o projeto Supabase do proprietário, configurar Auth e aplicar
   somente o SQL aditivo `supabase/billing.sql`.
2. Publicar `billing` e `stripe-webhook` nesse projeto.
3. Importar os preços de `supabase/.env.stripe-test.local` (arquivo local ignorado
   pelo Git, sem chaves secretas) para os secrets do backend.
4. Configurar `STRIPE_SECRET_KEY` da mesma sandbox exclusivamente no servidor.
5. Criar o destino de eventos Stripe com a URL real da função publicada e salvar
   seu `STRIPE_WEBHOOK_SECRET` no servidor, conforme `docs/checkout.md`.
6. Configurar as variáveis públicas Supabase e `VITE_BILLING_ENABLED=true` no
   frontend somente após as etapas anteriores; reiniciar o Vite.
7. Validar cadastro, confirmação de e-mail, sessão de Checkout, pagamento de teste,
   retorno e persistência da assinatura recebida via webhook.

Não reutilizar estes IDs em outra conta Stripe nem em produção. Não colocar
chaves secretas em arquivos públicos, variáveis `VITE_*`, documentação ou chat.
Manter `ALLOW_LIVE_PAYMENTS=false`; os bloqueios de comercialização descritos em
`docs/checkout.md` continuam válidos.
