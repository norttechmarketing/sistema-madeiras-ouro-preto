
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, OrderItem, Client } from '../types';
import { COMPANY_INFO } from '../constants';



export const generateOrderPDF = async (order: Order, openPrint = false, client?: Client) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  const redColor = '#9b2b29';
  const grayColor = '#666666';

  const unitLabels: Record<string, string> = {
    'm2': 'm²', 'm3': 'm³', 'm': 'm', 'un': 'un', 'ML': 'ML', 'Pç': 'Pç', 'Kg': 'Kg', 'JG': 'JG'
  };

  // Watermark
  doc.setTextColor(230, 230, 230);
  doc.setFontSize(60);
  doc.setFont('helvetica', 'bold');
  const watermarkText = order.type === 'Orçamento' ? 'ORÇAMENTO' : 'PEDIDO';

  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
  doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
    align: 'center',
    angle: 45,
    renderingMode: 'fill'
  });
  doc.restoreGraphicsState();

  // Header Background Bar
  doc.setFillColor(redColor);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Load and Add Logo
  try {
    const logoUrl = 'https://nyltechsite.com.br/wp-content/uploads/2026/01/Logo.png';
    const img = await new Promise<string>((resolve, reject) => {
      const i = new Image();
      // Try to bypass cache issues that sometimes cause CORS failures
      i.src = `${logoUrl}?t=${new Date().getTime()}`;
      i.crossOrigin = 'anonymous';
      i.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = i.width;
        canvas.height = i.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(i, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            reject(err);
          }
        } else {
          reject();
        }
      };
      i.onerror = () => reject();
      setTimeout(() => reject(new Error("Logo timeout")), 8000);
    });
    doc.addImage(img, 'PNG', 14, 8, 30, 30);
  } catch (e) {
    console.error("Could not load logo for PDF", e);
    // Silent fallback: just don't show the logo if it fails, ensuring PDF is still generated
  }

  // Company Name and Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(COMPANY_INFO.name.toUpperCase(), 50, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Sistema de Gestão de Pedidos", 50, 28);

  // Document Type and ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const docTitle = `${order.type.toUpperCase()}`;
  doc.text(docTitle, pageWidth - 14, 22, { align: 'right' });

  doc.setFontSize(10);
  const docId = `#${order.id.slice(-6).toUpperCase()}`;
  doc.text(docId, pageWidth - 14, 28, { align: 'right' });

  // Premium Header Details (White text on burgundy)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const contactInfo = `CNPJ: ${COMPANY_INFO.cnpj}  |  WhatsApp: ${COMPANY_INFO.phoneDisplay}  |  ${COMPANY_INFO.address}`;
  doc.text(contactInfo, 50, 35);

  // Divider Line
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(50, 38, pageWidth - 14, 38);

  // Date and Seller (Just below header)
  doc.setTextColor(grayColor);
  doc.setFontSize(9);
  const dateStr = `Data: ${new Date(order.date).toLocaleDateString()}`;
  doc.text(dateStr, pageWidth - 14, 52, { align: 'right' });

  if (order.sellerName) {
    const sellerStr = `Vendedor: ${order.sellerName}`;
    doc.text(sellerStr, pageWidth - 14, 57, { align: 'right' });
  }

  // Client Info Section
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text("DADOS DO CLIENTE", 14, 68);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.line(14, 70, pageWidth - 14, 70);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Nome:", 14, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(order.clientName, 26, 76);

  doc.setFont('helvetica', 'bold');
  doc.text("CPF/CNPJ:", 14, 81);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.document || 'Não informado', 34, 81);

  doc.setFont('helvetica', 'bold');
  doc.text("WhatsApp:", 100, 81);
  doc.setFont('helvetica', 'normal');
  doc.text(client?.phone || 'Não informado', 120, 81);

  doc.setFont('helvetica', 'bold');
  doc.text("Endereço:", 14, 86);
  doc.setFont('helvetica', 'normal');
  const clientAddr = client?.address || 'Não informado';
  const splitAddress = doc.splitTextToSize(clientAddr, pageWidth - 32);
  doc.text(splitAddress, 32, 86);

  // Re-adjust startY for the table based on address height
  const addressLines = splitAddress.length;
  const tableStartY = 86 + (addressLines * 4) + 2;

  const tableColumn = ["Descrição", "Qtd", "Comp.", "Larg.", "Benef.", "Un", "Vl. Unit.", "Total"];
  const tableRows: any[] = [];

  order.items.forEach((item: OrderItem) => {
    const itemData = [
      item.description,
      item.quantity.toString(),
      item.comprimento ? item.comprimento.toString() : '-',
      item.largura ? item.largura.toString() : '-',
      item.isBeneficiado ? 'Benef.' : '-',
      unitLabels[item.unit] || item.unit || 'un',
      `R$ ${item.unitPrice.toFixed(2)}`,
      `R$ ${item.total.toFixed(2)}`
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [tableColumn],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      5: { fontStyle: 'bold', halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const rightMargin = pageWidth - 14;

  doc.setFontSize(10);
  doc.setTextColor(grayColor);
  doc.text(`Subtotal: R$ ${order.subtotal.toFixed(2)}`, rightMargin, finalY, { align: 'right' });
  doc.text(`Descontos: R$ ${order.totalDiscount.toFixed(2)}`, rightMargin, finalY + 6, { align: 'right' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(redColor);
  doc.text(`Total Final: R$ ${order.total.toFixed(2)}`, rightMargin, finalY + 15, { align: 'right' });

  if (order.customerNotes) {
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("OBSERVAÇÕES:", 14, finalY + 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(order.customerNotes, pageWidth - 28);
    doc.text(splitNotes, 14, finalY + 31);
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setDrawColor(230, 230, 230);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, footerY);
  doc.text("Madeiras Ouro Preto - Qualidade e Tradição em Madeiras", pageWidth - 14, footerY, { align: 'right' });

  const fileName = `OuroPreto_${order.type.toUpperCase()}_${order.id.slice(-6).toUpperCase()}.pdf`;

  if (openPrint) {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(fileName);
  }
};

