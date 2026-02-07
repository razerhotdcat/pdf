import { useState } from 'react';

function App() {
  const [html, setHtml] = useState('<h1>Hello PDF!</h1><p>This is a test.</p>');
  const [loading, setLoading] = useState(false);

  const generatePDF = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `document-${Date.now()}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        alert('PDF 생성 성공!');
      } else {
        alert('PDF 생성 실패');
      }
    } catch (error) {
      alert('서버 연결 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            PDF Generator 🚀
          </h1>
          <p className="text-gray-600">
            HTML을 PDF로 변환하세요
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <label className="block mb-3 font-semibold text-gray-700">
            HTML 입력:
          </label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full h-64 p-4 border-2 border-gray-200 rounded-lg font-mono text-sm focus:border-blue-500 focus:outline-none transition"
            placeholder="HTML을 입력하세요..."
          />
        </div>

        <button
          onClick={generatePDF}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg hover:shadow-xl"
        >
          {loading ? '⏳ 생성 중...' : '📄 PDF 생성하기'}
        </button>

        <div className="mt-6 text-center text-sm text-gray-600">
          💡 Tip: HTML 태그를 사용해보세요!
        </div>
      </div>
    </div>
  );
}

export default App;