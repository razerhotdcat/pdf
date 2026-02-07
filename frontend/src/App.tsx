import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';

type Template = 'blank' | 'receipt' | 'invoice';

const templates = {
  blank: '<h1>제목을 입력하세요</h1>\n<p>내용을 작성하세요.</p>',
  receipt: `<div style="font-family: Arial; padding: 20px;">
  <h2 style="text-align: center;">영수증</h2>
  <p><strong>날짜:</strong> 2026-02-08</p>
  <p><strong>고객명:</strong> 홍길동</p>
  <hr/>
  <table style="width: 100%; border-collapse: collapse;">
    <tr><th>항목</th><th>수량</th><th>금액</th></tr>
    <tr><td>상품 A</td><td>2</td><td>20,000원</td></tr>
  </table>
  <hr/>
  <p style="text-align: right;"><strong>합계: 20,000원</strong></p>
</div>`,
  invoice: `<div style="font-family: Arial; padding: 20px;">
  <h1>견적서</h1>
  <p>견적번호: EST-2026-001</p>
  <p>고객사: ABC 주식회사</p>
  <hr/>
  <table style="width: 100%; border: 1px solid #ddd;">
    <tr><th>항목</th><th>금액</th></tr>
    <tr><td>웹사이트 개발</td><td>5,000,000원</td></tr>
  </table>
  <p style="text-align: right;"><strong>총액: 5,000,000원</strong></p>
</div>`
};

function App() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template>('blank');
  const [html, setHtml] = useState(templates.blank);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    paperSize: 'A4',
    orientation: 'portrait',
    margin: '20'
  });

  const handleTemplateChange = (template: Template) => {
    setSelectedTemplate(template);
    setHtml(templates[template]);
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/pdf/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html,
          format: options.paperSize,
          landscape: options.orientation === 'landscape',
          margin: options.margin === '0' ? 'none' : options.margin === '10' ? 'narrow' : options.margin === '40' ? 'wide' : 'normal',
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `document-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success('PDF 생성 완료!');
      } else {
        toast.error('PDF 생성 실패');
      }
    } catch {
      toast.error('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page">
      <Toaster position="top-right" />

      <div className="app-container">
        <header className="app-header">
          <h1 className="app-title">PDF Generator</h1>
          <p className="app-subtitle">HTML을 PDF로 변환하세요</p>
        </header>

        <div className="card">
          <div className="template-row">
            <button
              type="button"
              onClick={() => handleTemplateChange('blank')}
              className={`btn-template ${selectedTemplate === 'blank' ? 'active' : ''}`}
            >
              빈 문서
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('receipt')}
              className={`btn-template ${selectedTemplate === 'receipt' ? 'active' : ''}`}
            >
              영수증
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('invoice')}
              className={`btn-template ${selectedTemplate === 'invoice' ? 'active' : ''}`}
            >
              견적서
            </button>
          </div>
        </div>

        <div className="main-grid">
          <div className="card">
            <label className="section-label">HTML 에디터</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              className="editor-textarea"
              placeholder="HTML을 입력하세요..."
              spellCheck={false}
            />
          </div>

          <div className="card">
            <label className="section-label">실시간 미리보기</label>
            <div
              className="preview-box"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        <div className="card">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="options-toggle"
          >
            <span>고급 옵션</span>
            <span>{showOptions ? '▲' : '▼'}</span>
          </button>

          {showOptions && (
            <div className="options-grid">
              <div>
                <label className="field-label">용지 크기</label>
                <select
                  value={options.paperSize}
                  onChange={(e) => setOptions({ ...options, paperSize: e.target.value })}
                  className="field-select"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="A5">A5</option>
                </select>
              </div>
              <div>
                <label className="field-label">방향</label>
                <select
                  value={options.orientation}
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value })}
                  className="field-select"
                >
                  <option value="portrait">세로</option>
                  <option value="landscape">가로</option>
                </select>
              </div>
              <div>
                <label className="field-label">여백</label>
                <select
                  value={options.margin}
                  onChange={(e) => setOptions({ ...options, margin: e.target.value })}
                  className="field-select"
                >
                  <option value="0">없음</option>
                  <option value="10">좁게</option>
                  <option value="20">보통</option>
                  <option value="40">넓게</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={generatePDF}
          disabled={loading}
          className="btn-generate"
        >
          {loading ? (
            <>
              <span className="spinner" />
              생성 중...
            </>
          ) : (
            'PDF 생성하기'
          )}
        </button>
      </div>
    </div>
  );
}

export default App;
