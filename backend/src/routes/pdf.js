import express from 'express';
import puppeteer from 'puppeteer';

const router = express.Router();

const MARGIN_MAP = { none: '0', narrow: '10px', normal: '20px', wide: '40px' };

router.post('/generate', async (req, res) => {
  try {
    const { html, format = 'A4', landscape = false, margin = 'normal' } = req.body;
    
    if (!html) {
      return res.status(400).json({ 
        success: false,
        error: 'HTML is required' 
      });
    }

    const marginVal = MARGIN_MAP[margin] ?? MARGIN_MAP.normal;
    const marginObj = { top: marginVal, right: marginVal, bottom: marginVal, left: marginVal };

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: format === 'Letter' || format === 'A5' ? format : 'A4',
      landscape: !!landscape,
      printBackground: true,
      margin: marginObj
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=document-${Date.now()}.pdf`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;