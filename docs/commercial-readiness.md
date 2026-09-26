# LsBarber: prontidão para comercialização

Estado em 26/09/2026: **não lançar nem aceitar pagamentos reais ainda**.
O fluxo de compra com cartão de teste passou, mas o ambiente atual usa localhost,
Stripe em modo de teste e uma conta ainda exibida publicamente como “Lshub”.
`ALLOW_LIVE_PAYMENTS` deve permanecer `false`.

## Já implementado e verificado

- Cadastro com confirmação de e-mail, checkout Stripe hospedado, webhook assinado
  e registro da assinatura. Um pagamento Pro mensal de **teste** foi confirmado
  na Stripe e no Supabase; detalhes em `docs/stripe-sandbox.md`.
- Painel comercial bloqueado sem conta confirmada e assinatura ativa ou em teste.
  A leitura e escrita do espaço da barbearia pertencem somente ao proprietário.
- O banco valida os limites de 1/3/8 profissionais, nega gravações sem assinatura
  e protege contra sobrescrita silenciosa entre abas. Após uma redução de plano,
  permite remover profissionais excedentes gradualmente, sem permitir aumentá-los.
  Tabelas antigas compartilhadas não têm mais acesso pela chave pública nem
  políticas legadas de leitura/escrita. O SQL de isolamento passou no projeto,
  incluindo uma verificação explícita de que `anon` não possui privilégios nas
  tabelas comerciais e de que `authenticated` não acessa as tabelas antigas.
- Exportação JSON dos dados da própria barbearia, inclusive após o fim do plano.
  Gestão de cartão, faturas e cancelamento foi integrada ao portal Stripe no código;
  as opções aparecem habilitadas no painel de testes, mas o percurso real do
  portal ainda não foi validado.
- A saída explícita da conta agora aguarda a gravação das alterações pendentes
  (até 15 segundos). Se a gravação falhar ou demorar, mantém a sessão aberta e
  oferece exportação dos dados. Falhas inesperadas da chamada de gravação
  deixam o estado como não salvo, em vez de travar permanentemente em “Salvando”.
  Este comportamento passou por typecheck/build, mas ainda requer teste de
  interação no navegador com rede lenta e erro de gravação.
- O servidor rejeita um preço Stripe divergente do catálogo. Chaves live exigem
  liberação explícita **e** domínio público HTTPS. Os testes automatizados das
  funções, o typecheck e o build passaram. A interface nova ainda carece de revisão
  visual e testes de interação no navegador.
- A criação de checkout live exige também uma audiência explícita. No modo
  `restricted`, só o UUID de teste autorizado pode comprar; sem configuração,
  falha fechado. A função foi publicada no projeto ainda em modo de teste e
  14 testes simulados passaram. Não houve ativação nem cobrança live.
- Assinaturas e clientes Stripe de teste/live são separados. O teste Pro ativo
  não libera o painel em modo live; essa separação foi exercitada no banco.
- Os quatro registros operacionais legados pedidos para remoção foram apagados
  após conferência de IDs; a tabela vazia `novo_stilo_state` também foi removida.
  A assinatura e o cliente de teste da Stripe foram preservados. Scripts de
  execução única e verificação estão descritos em `docs/stripe-sandbox.md`.
- O retorno da compra só anuncia o plano como ativo depois que o pagamento e o
  registro da assinatura correspondente estão confirmados. Enquanto o webhook
  não for processado, informa que a ativação está pendente e consulta de novo
  por até 30 segundos, sem oferecer outra compra. A função `billing` corrigida
  foi publicada no projeto de testes; os testes automatizados passaram. O
  percurso dessa nova tela no navegador ainda não foi validado.
- O webhook usa o preço recorrente atual da assinatura para determinar plano e
  periodicidade; não confia nos metadados do checkout depois de uma alteração no
  portal. Preço desconhecido, quantidade diferente de 1 ou múltiplos itens
  bloqueiam o acesso até correção. A função atualizada foi publicada e os testes
  simulados passaram. A troca de plano permanece desabilitada no portal atual;
  esse percurso ainda exige validação real antes de ser oferecido.
- A apresentação deixou de carregar o cliente Supabase e o painel junto com a
  rota inicial. No build local, o pacote `index` caiu de aproximadamente 712 kB
  para 333 kB (antes de gzip); o Supabase ficou em pacote separado, requisitado
  pelas rotas de compra/painel. A animação da apresentação foi mantida. O
  `npm audit` completo retornou zero vulnerabilidades conhecidas em 26/09/2026.
  `vercel.json` também define cabeçalhos básicos de segurança; nenhum desses
  ajustes foi verificado num deployment público, pois ele continua protegido.

## Dependências de lançamento

1. **Endereço e hospedagem:** o responsável ainda não possui domínio próprio.
   Um subdomínio HTTPS estável da Vercel pode servir para o lançamento inicial,
   se for escolhido como endereço definitivo; domínio personalizado não é um
   bloqueio técnico isolado. A URL atual exige login na Vercel e, portanto,
   não está pública para compradores. Em 26/09/2026, o aplicativo atualizado
   estava somente no checkout Git da pasta principal: `origin/main` continha
   apenas um README e a pasta aninhada `lsbarber` apontava para uma cópia antiga.
   A Vercel abriu na tela de login, então ainda não foi possível confirmar qual
   repositório, branch e diretório ela usa. Resolver essa origem, publicar o
   frontend com fallback para as rotas da SPA, configurar `APP_URL` na função e
   os redirects permitidos em Supabase Auth. Testar cadastro, confirmação por
   e-mail, checkout e retorno no endereço escolhido. Retirar a proteção de
   acesso apenas quando o site, textos legais e suporte estiverem prontos.
   Nunca usar localhost como retorno de produção.
2. **Identidade e suporte:** ainda faltam razão social/nome do responsável,
   CNPJ/CPF comercial, endereço comercial e e-mail de suporte. Definir dados de
   faturamento, política de atendimento, identificação do vendedor e canal de
   contato antes de convidar clientes.
3. **Termos e privacidade:** preparar Termos de Uso, Política de Privacidade e
   política de cancelamento/reembolso com os dados verdadeiros acima; revisar
   juridicamente e apresentar/registrar o aceite quando aplicável. Definir
   retenção, exclusão, resposta a solicitações dos titulares e tratamento de
   incidentes. Não publicar textos com dados fictícios.
4. **Stripe live:** concluir a ativação/verificação da conta exclusiva da
   LsBarber, corrigir o nome público hoje exibido como “Lshub”, cadastrar os
   seis preços recorrentes no modo live e ativar/configurar o Billing Portal.
   Criar endpoint webhook live, conferir eventos e colocar `sk_live_`, `whsec_`
   e IDs `price_` live somente nos secrets da função. Validar impostos e o total
   exibido antes de vender. Não copiar os IDs de teste para o modo live. Após
   configurar todas as dependências, alterar a única linha de
   `billing_environment` para `live_mode=true` na virada controlada; a função
   bloqueia checkout quando esse valor e a chave Stripe não correspondem.
   `LIVE_CHECKOUT_AUDIENCE=restricted` limita a criação de checkout live ao
   `LIVE_TEST_USER_ID` até a abertura pública explícita.
5. **Operação:** definir provedor de e-mail transacional e remetente autenticado,
   quotas de Auth, alertas de falhas de webhook/checkout, rotina de backup com
   restauração testada e procedimento de suporte. Verificar limites e custos do
   Supabase/host para o volume esperado. O envio padrão do Supabase aceita só
   endereços autorizados da equipe e não é adequado a cadastros públicos; o
   fluxo de redefinição de senha foi implementado, mas depende do SMTP e ainda
   não passou por teste de recebimento do e-mail. A consulta do projeto em
   26/09/2026 retornou `backups=[]` e `pitr_enabled=false`: ainda não existe
   restauração de banco demonstrada. O auditor mostra apenas o aviso de proteção
   contra senhas vazadas desativada; esse recurso requer Supabase Pro ou superior.
   A contratação de plano pago ou de backup externo depende de decisão do
   responsável, seguida de teste real de restauração.
6. **Aceitação:** testar em sandbox cartão aprovado, recusado, 3DS, renovação,
   inadimplência, cancelamento, retorno do portal, conta sem assinatura, troca
   de conta, exportação e duas abas concorrentes. Fazer revisão visual em
   desktop/mobile e acessibilidade básica. Depois, no domínio final, executar
   uma compra live controlada, conferir Stripe, webhook, banco, acesso ao painel,
   fatura e cancelamento; reembolsar/cancelar a compra de teste live conforme a
   política definida. A compra controlada exige `ALLOW_LIVE_PAYMENTS=true`, mas
   a audiência deve continuar `restricted` até a aprovação de todas as etapas.

## Virada live controlada — ainda não executar

1. Com domínio HTTPS, site de produção preparado, textos/suporte publicados,
   SMTP, backup restaurável e Stripe live configurados, definir `APP_URL`,
   `sk_live_`, `whsec_`, os seis IDs live, `LIVE_CHECKOUT_AUDIENCE=restricted`
   e `LIVE_TEST_USER_ID` de uma conta confirmada. Manter o site fora da divulgação
   pública. Não registrar segredos no Git ou em variáveis `VITE_*`.
2. Publicar as funções e mudar `billing_environment.live_mode` para `true`.
   Definir `ALLOW_LIVE_PAYMENTS=true` somente nesta janela controlada. Com uma
   chave live, audiência ausente ou diferente de `restricted`/`public` bloqueia
   novas compras; no modo `restricted`, qualquer outra conta recebe 403.
3. Executar uma compra real pequena pela conta autorizada, conferir preço,
   imposto, webhook, acesso, portal, fatura e cancelamento/reembolso. Repetir
   os testes críticos de login, e-mail e rotas no endereço definitivo.
4. Se algo falhar, voltar `ALLOW_LIVE_PAYMENTS=false` para impedir novas sessões
   e investigar a Stripe; manter `live_mode=true` se houver assinatura live,
   para que assinaturas de teste não voltem a conceder acesso. O portal pode
   ficar indisponível com a chave live bloqueada; atender cancelamentos pelo
   painel Stripe durante a intervenção.
5. Somente após a aceitação, alterar `LIVE_CHECKOUT_AUDIENCE=public`, conferir
   a resposta da função e retirar a proteção do site para compradores. Verificar
   os cabeçalhos e redirects no deployment público antes de anunciar a venda.

## Configuração de produção, quando as dependências estiverem prontas

- Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no host, com build de
  produção. O modo comercial já é obrigatório em builds de produção.
- Definir `APP_URL=https://dominio-escolhido` e secrets Stripe live no Supabase.
  Republicar `billing` e `stripe-webhook`; verificar a resposta dos endpoints.
- Adicionar a origem e o redirect HTTPS no Supabase Auth. Conferir remetente,
  confirmação de e-mail e links recebidos em diferentes provedores.
- Executar `supabase/billing.sql` e `supabase/commercial.sql` se for usado outro
  projeto Supabase. No projeto atual ambos já foram aplicados; não recriar dados
  ou remover as tabelas antigas sem plano de migração/retensão.
- Não alterar `ALLOW_LIVE_PAYMENTS` antes da janela de teste live restrito.
  A chave secreta Stripe e o segredo do webhook nunca vão em variáveis `VITE_*`
  ou no Git.

Esta lista é um controle técnico de lançamento, não substitui avaliação
contábil/jurídica nem comprova conformidade por si só.
