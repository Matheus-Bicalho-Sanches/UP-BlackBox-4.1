
---

Arquitetura BlackBox 3.0

1) Abas;

    * Posições (consolidada e por cliente);
    * Ordens (envio e acompanhamento);
    * Boletas; 
    * Saldo (D+0, D+1 e D+2)
    * Base de dados;
    * Import Profit;
    * Estratégias;
    * Backtests.

2) Arquitetura em si

FRONTEND (up-gestora ou local?) <-> Backend intermediário websocket (Railway) <-> Backend do DLL (Railway ou local?)

Essa comunicação acima permite o front end receber e enviar ordens para o backend praticamente em tempo real.

    2.1 -> Potenciais Problemas 

    * Muitas ordens em paralelo pode gerar problemas (usando os "threads" do Python) -> Escalável até 50-100 ordens em paralelo. Mais do que isso pode dar problema.

    2.2 -> Possíveis alternativas.

    * Async -> Não funciona nativamente na DLL. Precisaríamos testar uma gambiarra para ver se funciona. Se funcionar, possivelmente a melhor solução.

    * Usar threads mesmo, mas tentar não passar de 50-100 threads em paralelo (cada "fila" de clientes aguardando execução conta como 1 thread, independentemente da quantidade de clientes)

    * Multiprocessing -> Mais complexo e demandaria mais capacidade computacional. Bem mais escalável. Usar como última alternativa?

3) Detalhamento da aba "Posições";

Precisemos que esse aba tenha:

    3.1 -> Liste todas as posições (ativo e quantidade) de todos os clientes de forma consolidada;
    3.2 -> Permita pesquisa por cliente e liste todas as posições desse cliente.
    
4) Detalhamento da aba "Boletas";

    4.1 -> Tipos de ordens;

    * Ordem cheia (todo valor que você quer comprar/vender, sem iceberg)
    * Ordem iceberg (Ordem cheia dividida em Iceberg de X quantidades cada)
    * TWAP;
    * VWAP;
    * Sempre cobrir preço até um valor de X.

5) Detalhamento da aba "Ordens";

Precisemos que essa aba tenha:

    5.1 -> Liste todas as ordens (ativo, quantidade total, status da ordem, tipo de boleta/ordem usada, quantidade executada) de todos os clientes de forma consolidada;
    5.2 -> Permita pesquisa por cliente e liste todas as ordens desse cliente.


   


X) Dúvidas ou problemas pendentes;

    X.1 -> Botão de stop/pânico -> Como assumir o controle manualmente se o programa der problema ou pior, se a energia/internet cair?

    X.2 -> Como aumentar a segurança? Colocar proteções e camadas adicionais de proteção para evitar hackers, Ddos e outros ataques.

    X.3 -> Faz sentido permitir o envio de ordens na nuvem (Vercel / Up-gestora)? Não seria mais seguro fazer o frontend de emissão de ordens rodar localmente?


