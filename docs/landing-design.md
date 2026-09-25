# LsBarber — página de apresentação

Público: proprietários de barbearias. Objetivo: conhecer os módulos e abrir o sistema.
Rota: /apresentacao. O painel existente continua em /.

## Referências e direção

Refero MCP indisponível (NO_SUBSCRIPTION). Pesquisa apoiada nas referências locais
refero-design/references/craft-details.md e copywriting.md e na interface existente.
Construção direta ancorada no sistema existente: carvão, dourado e imagens reais do produto.

| Decisão | Fonte | Aplicação |
| --- | --- | --- |
| Carvão e dourado | src/styles.css e AppShell | Fundo escuro; dourado para ações e pequenos indicadores |
| Produto como prova | copywriting.md, Proof Beats Hype | Prints reais; identificação de dados fictícios; sem depoimentos ou métricas inventadas |
| Texto claro orientado à rotina | copywriting.md, Marketing Hero | Agenda, comanda, estoque e comissão como argumentos concretos |
| Imagens dimensionadas | craft-details.md, Images | Proporção reservada; imagens abaixo da dobra com lazy loading |
| Navegação acessível | craft-details.md, Focus/Accessibility | Foco visível, links nativos, galeria com botões e modal nativo |

Alvo visual: hero assimétrico com título grande, tipografia sem serifa, preview do
dashboard em moldura escura; galeria clara de módulos; faixa escura final de conversão.
Preservar: contraste, ritmo generoso, ouro contido, imagens legíveis, frases concretas.
Evitar: gráficos falsos, preços sem definição, promessas de crescimento ou segurança não comprovadas.

Dados demonstrativos existem apenas no script de captura, em contexto de navegador
descartável. O script bloqueia chamadas ao Supabase e não importa fixtures na aplicação.
