import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function DateTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)

  const parsedDate = value ? new Date(value) : new Date()
  const isValid = !isNaN(parsedDate.getTime())
  const activeDate = isValid ? parsedDate : new Date()

  const [currentYear, setCurrentYear] = useState(activeDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(activeDate.getMonth())
  const [selectedDay, setSelectedDay] = useState(activeDate.getDate())
  const [selectedHour, setSelectedHour] = useState(activeDate.getHours())
  const [selectedMinute, setSelectedMinute] = useState(activeDate.getMinutes())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear())
        setCurrentMonth(d.getMonth())
        setSelectedDay(d.getDate())
        setSelectedHour(d.getHours())
        setSelectedMinute(d.getMinutes())
      }
    }
  }, [value])

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()

  const prevDaysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const prevDaysList = Array.from({ length: firstDayIndex }, (_, i) => prevDaysInMonth - firstDayIndex + 1 + i)
  const currentDaysList = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function updateDateTime(day: number, hour: number, minute: number) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const formatted = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
    onChange(formatted)
  }

  function handleDaySelect(day: number) {
    setSelectedDay(day)
    updateDateTime(day, selectedHour, selectedMinute)
  }

  function handleHourChange(hour: number) {
    setSelectedHour(hour)
    updateDateTime(selectedDay, hour, selectedMinute)
  }

  function handleMinuteChange(minute: number) {
    setSelectedMinute(minute)
    updateDateTime(selectedDay, selectedHour, minute)
  }

  function handleQuickTime(h: number, m: number) {
    setSelectedHour(h)
    setSelectedMinute(m)
    updateDateTime(selectedDay, h, m)
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const displayDateStr = () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(selectedDay)}/${pad(currentMonth + 1)}/${currentYear}, ${pad(selectedHour)}:${pad(selectedMinute)}`
  }

  return (
    <div className="custom-datetime-picker" style={{ width: '100%' }}>
      <style>{`
        .datepicker-trigger-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 41px;
          padding: 0 12px;
          background: #292926;
          border: 1px solid #474743;
          border-radius: 7px;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }
        .datepicker-trigger-btn:focus, .datepicker-trigger-btn:hover {
          border-color: #c6ff38;
          box-shadow: 0 0 0 3px rgba(198, 255, 56, 0.15);
        }
        .datepicker-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999999 !important;
          display: grid;
          place-items: center;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(10px);
          padding: 16px;
          animation: datepickerFadeIn 0.2s ease;
        }
        @keyframes datepickerFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .datepicker-modal-card {
          width: min(390px, 94vw);
          background: #171717;
          border: 1px solid #383834;
          border-radius: 20px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.95);
          padding: 24px;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .datepicker-modal-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .datepicker-modal-eyebrow {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.1px;
          color: #c6ff38;
          display: block;
          margin-bottom: 2px;
        }
        .datepicker-modal-head h3 {
          margin: 0;
          font-size: 20px;
          letter-spacing: -0.8px;
          font-weight: 800;
        }
        .datepicker-modal-close {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #fff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 20px;
          display: grid;
          place-items: center;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1;
        }
        .datepicker-modal-close:hover {
          background: rgba(255,255,255,0.2);
          color: #c6ff38;
        }
        .datepicker-month-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #22221f;
          border: 1px solid #33332e;
          border-radius: 10px;
        }
        .datepicker-month-nav b {
          font-size: 13px;
          letter-spacing: -0.3px;
        }
        .datepicker-month-nav button {
          background: transparent;
          border: none;
          color: #c6ff38;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          padding: 0 8px;
        }
        .datepicker-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          text-align: center;
        }
        .datepicker-grid span.weekday {
          font-size: 9px;
          font-weight: 800;
          color: #85857e;
          padding-bottom: 2px;
        }
        .datepicker-grid button {
          height: 34px;
          border-radius: 8px;
          font-size: 12px;
          background: transparent;
          border: none;
          color: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
          display: grid;
          place-items: center;
        }
        .datepicker-grid button.other-month {
          color: #4a4a45;
          cursor: default;
          pointer-events: none;
        }
        .datepicker-grid button:hover:not(.other-month) {
          background: rgba(198, 255, 56, 0.15);
          color: #c6ff38;
        }
        .datepicker-grid button.selected {
          background: #c6ff38 !important;
          color: #171717 !important;
          font-weight: 900;
        }
        .timepicker-popup-box {
          background: #22221f;
          border: 1px solid #383834;
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .timepicker-popup-label {
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.1px;
          color: #85857e;
          text-align: center;
        }
        .timepicker-popup-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }
        .timepicker-popup-controls label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }
        .timepicker-popup-controls label span {
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #85857e;
        }
        .timepicker-popup-controls select {
          background: #171717;
          border: 1px solid #4a4a45;
          border-radius: 8px;
          color: #fff;
          padding: 8px 14px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          appearance: auto !important;
          outline: none;
        }
        .timepicker-popup-controls select:focus {
          border-color: #c6ff38;
        }
        .timepicker-colon {
          font-size: 24px;
          font-weight: 900;
          color: #c6ff38;
          margin-top: 12px;
        }
        .timepicker-popup-quick {
          display: flex;
          gap: 6px;
        }
        .timepicker-popup-quick button {
          flex: 1;
          padding: 7px 0;
          background: #2a2a26;
          border: 1px solid #3d3d38;
          border-radius: 6px;
          color: #aaa9a1;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .timepicker-popup-quick button:hover {
          background: #33332e;
          color: #c6ff38;
          border-color: #c6ff38;
        }
        .datepicker-confirm-action {
          width: 100%;
          padding: 13px;
          background: #c6ff38;
          color: #171717;
          border: none;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.6px;
          cursor: pointer;
          text-align: center;
          transition: background 0.15s ease;
        }
        .datepicker-confirm-action:hover {
          background: #d4ff5c;
        }
      `}</style>
      
      <button 
        type="button" 
        className="datepicker-trigger-btn"
        onClick={() => setIsOpen(true)}
      >
        <span>{displayDateStr()}</span>
        <span style={{ color: '#c6ff38', fontSize: '15px' }}>📅</span>
      </button>

      {isOpen && createPortal(
        <div 
          className="datepicker-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          <div className="datepicker-modal-card">
            <div className="datepicker-modal-head">
              <div>
                <span className="datepicker-modal-eyebrow">AGENDA & PRAZOS</span>
                <h3>Selecionar Data & Hora</h3>
              </div>
              <button 
                type="button" 
                className="datepicker-modal-close"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="datepicker-month-nav">
              <button type="button" onClick={prevMonth}>‹</button>
              <b>{months[currentMonth]} de {currentYear}</b>
              <button type="button" onClick={nextMonth}>›</button>
            </div>

            <div className="datepicker-grid">
              <span className="weekday">DOM</span>
              <span className="weekday">SEG</span>
              <span className="weekday">TER</span>
              <span className="weekday">QUA</span>
              <span className="weekday">QUI</span>
              <span className="weekday">SEX</span>
              <span className="weekday">SÁB</span>

              {prevDaysList.map((d, i) => (
                <button key={`prev-${i}`} type="button" className="other-month">{d}</button>
              ))}

              {currentDaysList.map((d) => (
                <button 
                  key={`day-${d}`} 
                  type="button" 
                  className={selectedDay === d ? 'selected' : ''}
                  onClick={() => handleDaySelect(d)}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="timepicker-popup-box">
              <span className="timepicker-popup-label">HORÁRIO DE ENTREGA / REUNIÃO</span>
              <div className="timepicker-popup-controls">
                <label>
                  <span>HORA</span>
                  <select 
                    value={selectedHour} 
                    onChange={(e) => handleHourChange(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}h</option>
                    ))}
                  </select>
                </label>
                <span className="timepicker-colon">:</span>
                <label>
                  <span>MINUTOS</span>
                  <select 
                    value={selectedMinute} 
                    onChange={(e) => handleMinuteChange(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}m</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="timepicker-popup-quick">
                <button type="button" onClick={() => handleQuickTime(9, 0)}>09:00</button>
                <button type="button" onClick={() => handleQuickTime(12, 0)}>12:00</button>
                <button type="button" onClick={() => handleQuickTime(14, 30)}>14:30</button>
                <button type="button" onClick={() => handleQuickTime(18, 0)}>18:00</button>
              </div>
            </div>

            <button 
              type="button" 
              className="datepicker-confirm-action"
              onClick={() => setIsOpen(false)}
            >
              CONFIRMAR E APLICAR <span>→</span>
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
