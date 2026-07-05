import { jsPDF } from 'jspdf';

// Helper to draw wrapped text on canvas
const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight, align = 'right') => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  ctx.textAlign = align;
  
  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    let testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
};

export const generateInvoicesPDF = async (bills, batchName, totalRevenue) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const invoicesPerPage = 10;
  const totalPages = Math.ceil(bills.length / invoicesPerPage);

  const PAYMENT_LABELS = { cash: 'نقد', card: 'بطاقة', bank: 'تحويل بنكي', other: 'أخرى' };

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage();
    }

    // Create canvas for A4 page (high-resolution: 1240 x 1754)
    const canvas = document.createElement('canvas');
    canvas.width = 1240;
    canvas.height = 1754;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1240, 1754);

    // Decorative border
    ctx.strokeStyle = '#eab308'; // Primary gold color
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, 1200, 1714);
    ctx.strokeStyle = '#18181b'; // Dark color
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 1180, 1694);

    // --- Page Header (Only on page 1) ---
    let startY;
    if (pageIdx === 0) {
      // Title Banner
      ctx.fillStyle = '#18181b';
      ctx.fillRect(50, 60, 1140, 160);

      // Logo Text
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 44px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('مطعم تكة | TAKKA Restaurant', 1100, 125);

      // Subtitle
      ctx.fillStyle = '#ffffff';
      ctx.font = '30px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('تقرير الفواتير المجمعة والأرشيف الدوري', 1100, 185);

      // Info box
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(50, 240, 1140, 140);
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 240, 1140, 140);

      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`اسم الدفعة: ${batchName}`, 1100, 290);
      ctx.fillText(`تاريخ الأرشفة: ${new Date().toLocaleString('ar-EG')}`, 1100, 340);

      ctx.fillText(`إجمالي الدفعة: ${totalRevenue.toFixed(2)} ₪`, 450, 290);
      ctx.fillText(`عدد الفواتير: ${bills.length} فاتورة`, 450, 340);

      startY = 420;
    } else {
      // Header for subsequent pages
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('تقرير الفواتير المجمعة (تابع)', 1100, 80);
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText(`دفعة: ${batchName} | صفحة ${pageIdx + 1} من ${totalPages}`, 1100, 115);
      
      ctx.strokeStyle = '#e4e4e7';
      ctx.beginPath();
      ctx.moveTo(50, 130);
      ctx.lineTo(1190, 130);
      ctx.stroke();

      startY = 160;
    }

    // --- Table Header ---
    ctx.fillStyle = '#f4f4f5';
    ctx.fillRect(50, startY, 1140, 50);
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, startY, 1140, 50);

    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('رقم الفاتورة', 1090, startY + 32);
    ctx.fillText('الطاولة', 950, startY + 32);
    ctx.fillText('طريقة الدفع', 820, startY + 32);
    ctx.fillText('الوقت والتاريخ', 640, startY + 32);
    ctx.fillText('الأصناف والكميات', 370, startY + 32);
    ctx.fillText('الإجمالي', 110, startY + 32);

    // --- Invoice Rows ---
    let currentY = startY + 50;
    const startBillIdx = pageIdx * invoicesPerPage;
    const endBillIdx = Math.min(startBillIdx + invoicesPerPage, bills.length);

    for (let i = startBillIdx; i < endBillIdx; i++) {
      const bill = bills[i];
      const itemsStr = (bill.items || []).map(item => `${item.name} (${item.qty})`).join('، ');

      // Alternating row backgrounds
      if (i % 2 === 0) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(50, currentY, 1140, 100);
      }

      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, currentY, 1140, 100);

      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.textAlign = 'center';
      
      // Invoice ID
      ctx.fillText(bill.id || '—', 1090, currentY + 55);
      
      // Table
      ctx.font = '18px Arial, sans-serif';
      ctx.fillText(bill.tableName || '—', 950, currentY + 55);
      
      // Payment Method
      ctx.fillText(PAYMENT_LABELS[bill.paymentMethod] || bill.paymentMethod || '—', 820, currentY + 55);
      
      // Timestamp
      ctx.font = '16px Arial, sans-serif';
      ctx.fillText(`${bill.timeFormatted || ''} ${bill.dateFormatted || ''}`, 640, currentY + 55);
      
      // Items (with wrapping support)
      ctx.font = '16px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#3f3f46';
      drawWrappedText(ctx, itemsStr, 530, currentY + 35, 300, 24, 'right');
      
      // Total
      ctx.fillStyle = '#16a34a'; // Green total
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${(bill.total || 0).toFixed(1)} ₪`, 110, currentY + 55);

      currentY += 100;
    }

    // --- Footer ---
    ctx.fillStyle = '#71717a';
    ctx.font = '16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`صفحة ${pageIdx + 1} من ${totalPages}`, 620, 1710);
    ctx.textAlign = 'left';
    ctx.fillText('نظام إدارة مطعم تكة', 50, 1710);
    ctx.textAlign = 'right';
    ctx.fillText('توليد تلقائي آمن', 1190, 1710);

    // Convert canvas to image and add to PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  // Return base64 string
  const dataUri = doc.output('datauristring');
  // Strip header: "data:application/pdf;filename=generated.pdf;base64,"
  const base64Str = dataUri.split(';base64,')[1];
  return base64Str;
};
