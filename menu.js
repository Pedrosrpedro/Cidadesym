// menu.js

const Menu = {
    init: function() {
        DebugConsole.log("Menu.init: Configurando listeners do menu.");
        
        const addUniversalListener = (element, callback) => {
            if (!element) return;
            const action = (e) => { e.preventDefault(); callback(e); };
            element.addEventListener('click', action);
            element.addEventListener('touchstart', (e) => action(e), { passive: false });
        };
        
        const newGameBtn = document.getElementById('new-game-btn');
        const optionsBtn = document.getElementById('options-btn');
        const exitGameBtn = document.getElementById('exit-game-btn');
        const sairBtn = Array.from(document.querySelectorAll('.menu-button')).find(el => el.textContent === 'Sair');

        if (!newGameBtn || !optionsBtn || !exitGameBtn || !sairBtn) {
            DebugConsole.error("Menu.init: Um ou mais botões não foram encontrados no HTML!");
            return;
        }

        // --- Listeners ---
        addUniversalListener(newGameBtn, () => {
            DebugConsole.log("Botão 'Novo Jogo' pressionado.");
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('game-container').classList.remove('hidden');
            Game.init();
        });

        addUniversalListener(exitGameBtn, () => window.location.reload());

        addUniversalListener(optionsBtn, () => {
            DebugConsole.log("Botão 'Opções' (Tela Cheia) pressionado.");
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => DebugConsole.error(`Tela cheia falhou: ${err.message}`));
            } else {
                document.exitFullscreen();
            }
        });

        addUniversalListener(sairBtn, () => {
            if (confirm('Tem certeza de que deseja sair?')) alert('Obrigado por jogar!');
        });
        
        DebugConsole.log("Menu.init: Configuração do menu concluída.");
    }
};```

---

### **Passo 4: Substitua o `index.html`**

Este `index.html` referencia os arquivos na ordem correta e remove completamente o script "maestro" de dentro dele.

```html
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>CidadeSym - Menu Principal</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet">
</head>
<body>
    <!-- ... (Toda a estrutura de divs do menu, jogo e console continua igual) ... -->
    <div id="main-menu" class="menu-sidebar">...</div>
    <div id="game-container" class="hidden">...</div>

    <!-- SISTEMA DE DEBUG (com o novo botão de fechar) -->
    <button id="debug-toggle-btn">Console</button>
    <div id="debug-console-container" class="hidden">
        <div id="debug-header">
            <h3>Console de Debug</h3>
            <div>
                <button id="debug-clear-btn">Limpar</button>
                <!-- BOTÃO DE FECHAR NOVO -->
                <button id="debug-close-btn">Fechar [X]</button>
            </div>
        </div>
        <div id="debug-log"></div>
    </div>

    <!-- SCRIPTS - NOVA ORDEM DE CARREGAMENTO -->
    <!-- 1º Definições de Objetos -->
    <script src="console.js"></script> 
    <script src="game.js"></script>
    <script src="menu.js"></script> <!-- Renomeado de script.js -->
    
    <!-- 2º Bibliotecas Externas -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/nipplejs/0.9.0/nipplejs.min.js"></script>
    
    <!-- 3º PONTO DE ENTRADA PRINCIPAL -->
    <script src="main.js"></script>

</body>
</html>
