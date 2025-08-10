document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('.menu-nav a');

    menuLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const action = event.target.textContent;
            console.log(`O jogador clicou em: ${action}`);

            // Exemplo de como você pode adicionar funcionalidade no futuro
            if (action === 'Sair') {
                if (confirm('Tem certeza de que deseja sair?')) {
                    // Em um aplicativo real, você fecharia a janela.
                    // Para um site, não podemos fechar a aba, então podemos apenas mostrar uma mensagem.
                    alert('Obrigado por jogar!');
                    // window.close(); // Esta linha geralmente não funciona por razões de segurança.
                } else {
                    event.preventDefault(); // Impede a ação padrão do link se o usuário cancelar
                }
            } else {
                event.preventDefault(); // Impede a ação padrão para os outros links por enquanto
            }
        });
    });
});
