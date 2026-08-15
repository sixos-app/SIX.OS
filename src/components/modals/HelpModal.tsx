export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="generic-modal-overlay" role="dialog" aria-modal="true">
      <div className="generic-modal-dialog">
        <button className="close-button" type="button" onClick={onClose}>×</button>
        <div className="generic-modal-head">
          <h2>Ajuda & <em>Suporte SIX.OS</em></h2>
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.6', color: '#ccc' }}>
          <h3 style={{ color: '#c6ff38', fontSize: '14px', margin: '0 0 10px' }}>Atalhos de Teclado Rápido</h3>
          <ul style={{ paddingLeft: '20px', margin: '0 0 20px' }}>
            <li><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: '4px' }}>⌘ K</kbd> — Abrir Busca Global e Comandos</li>
            <li><kbd style={{ background: '#333', padding: '2px 6px', borderRadius: '4px' }}>Esc</kbd> — Fechar modais e janelas sobrepostas</li>
          </ul>
          <h3 style={{ color: '#c6ff38', fontSize: '14px', margin: '0 0 10px' }}>Suporte da Operação</h3>
          <p style={{ margin: '0 0 10px' }}>Dúvidas ou problemas operacionais? Fale diretamente com a equipe de tecnologia da SIX através do e-mail <b>suporte@sixos.app</b>.</p>
        </div>
      </div>
    </div>
  )
}
