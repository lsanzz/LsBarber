# Página de vendas da LsBarber

Execute `npm install` e `npm run dev`. A página está em
http://localhost:5173/apresentacao e o painel continua em http://localhost:5173/.

A página apresenta recursos, quatro capturas reais navegáveis (dashboard, agenda,
caixa e relatórios), ampliação de imagens, etapas de configuração, FAQ e acesso ao
painel. Não há preços, depoimentos ou canal de vendas fictícios.

Imagens responsivas em WebP (480, 800, 1200 e 1440 px), com carregamento tardio
abaixo da dobra e prioridade para o hero. `npm run optimize:marketing` regenera as
variantes usando Sharp. O comando de captura também executa essa otimização.
Os JPEGs são fontes de geração, não são carregados pela página.

Animações nativas de entrada, revelação ao rolar, troca de módulos, modal e feedback
dos botões seguem a referência motion.md do Refero. A preferência de movimento
reduzido desativa animações e transições. Não há biblioteca de animação no bundle.

Rolagem expressiva: entradas de 700 ms com sequência de 90 ms entre cards,
etapas e dúvidas, repetidas ao retornar às seções; previews com deslocamento de
até 18 px e escala sutil; barra fixa de progresso e navegação por âncoras suave.
O listener de scroll é passivo e agrupa as atualizações em requestAnimationFrame.
Movimento reduzido também desativa o parallax e a rolagem suave.

## Capturas

`npm run capture:marketing` usa Microsoft Edge headless via Playwright. Requer o
servidor local em execução. Para outra porta, defina a variável `CAPTURE_URL`.
As imagens são gravadas em `public/images/*.jpg` e entram no build automaticamente.

O script cria um contexto descartável, injeta fixtures apenas nesse navegador e
bloqueia chamadas externas, exceto fontes. Não modifica o banco remoto, o seed do
aplicativo nem o perfil do navegador usado pelo proprietário. Todos os valores e
nomes dos prints são ilustrativos. A data de referência é 25/09/2026.

## Verificação

`npm run verify:marketing` verifica interações, assets, ausência de erros JavaScript,
larguras 320/390/768 e desktop, além da ausência de cadastros fictícios em contexto
limpo. Salva evidências visuais em `artifacts/marketing/` (ignorado no Git).
`npm run build` gera a versão de produção.

Revisão visual realizada: desktop 1440 px e celular 390 px. Galeria, modal com Escape,
FAQ, menu e links de acesso validados. Build aprovado; o Vite aponta o aviso de
bundle acima de 500 kB, que não impede a geração.
