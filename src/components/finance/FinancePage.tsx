import { useEffect, useState } from 'react'
import { usePermission } from '../../hooks/usePermission'
import { Icon } from '../shared/Icon'

export function FinancePage() {
  const { can } = usePermission()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // We will fetch invoices or billing info here later
    setTimeout(() => {
      setIsLoading(false)
    }, 500)
  }, [])

  if (!can('finance.manage') && !can('finance.view') && !can('mission_costs.view')) {
    return (
      <div className="admin-page" style={{ padding: '34px', color: '#fff' }}>
        Você não tem permissão para acessar o financeiro.
      </div>
    )
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <span>GESTÃO FINANCEIRA</span>
          <h1>Financeiro & <em>Faturamento.</em></h1>
          <p>Acompanhe o faturamento, margens de lucro por missão e centros de custos.</p>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>

        <div style={{ background: '#191919', border: '1px solid #333', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: '40px', height: '40px', background: '#c6ff38', color: '#000', borderRadius: '8px' }}>
              <Icon name="dollar-sign" size={20} />
            </span>
            <h3 style={{ color: '#fff', margin: 0 }}>Faturamento (Em breve)</h3>
          </div>
          <p style={{ color: '#888', fontSize: '12px', lineHeight: 1.5 }}>
            O faturamento automático baseado nos contratos dos clientes e missões avulsas aparecerá aqui.
          </p>
        </div>

        <div style={{ background: '#191919', border: '1px solid #333', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: '40px', height: '40px', background: '#333', color: '#c6ff38', borderRadius: '8px' }}>
              <Icon name="pie-chart" size={20} />
            </span>
            <h3 style={{ color: '#fff', margin: 0 }}>Centros de Custos</h3>
          </div>
          <p style={{ color: '#888', fontSize: '12px', lineHeight: 1.5 }}>
            Os centros de custos já estão ativos no banco de dados. Você pode vinculá-los na criação de Missões para melhor rastreio financeiro da agência.
          </p>
        </div>

      </div>
    </div>
  )
}
