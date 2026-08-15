export function ComingSoon({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <section className="coming-soon">
      <p>EM CONSTRUÇÃO</p>
      <h1>{title}</h1>
      <span>Este módulo já tem navegação preparada. A próxima etapa conecta sua base de dados e os fluxos reais.</span>
      <button onClick={onBack}>VOLTAR PARA O INÍCIO <span>←</span></button>
    </section>
  )
}
