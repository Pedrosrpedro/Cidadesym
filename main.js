// main.js

// Este é o único ponto de entrada. Garante que todo o HTML foi carregado.
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa os sistemas que cuidam da Interface.
    // Eles apenas configuram os botões, não iniciam o jogo.
    Menu.init();
    UI.init();

    // A lógica do jogo 3D (Game.init) só será chamada
    // quando o botão "Novo Jogo" for clicado dentro do Menu.
    console.log("CidadeSym pronto.");
});
