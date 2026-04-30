
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, OrderItem, Client } from '../types';
import { COMPANY_INFO } from '../constants';
import { brasiliaTime } from './storage';



let cachedLogo: string | null = null;

/**
 * Carregamento seguro da logo com timeout e fallback
 * Resolve null se falhar ou demorar mais de 2s, impedindo travamento.
 */
const loadImageSafe = (url: string, timeoutMs: number = 2000): Promise<string | null> => {
  if (cachedLogo) return Promise.resolve(cachedLogo);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn("Logo não carregou (Timeout), gerando PDF sem logo.");
      resolve(null);
    }, timeoutMs);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      clearTimeout(timer);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          cachedLogo = canvas.toDataURL('image/png');
          resolve(cachedLogo);
        } catch (err) {
          console.error("Erro ao converter canvas:", err);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      console.warn("Logo não encontrada (/public/logo.png), gerando PDF sem logo.");
      resolve(null);
    };
  });
};

export const generateOrderPDF = async (order: Order, openPrint = false, client?: Client) => {

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const primaryColor = '#02904b';
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
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Load and Add Logo (Timeout 2s - garantindo não travar em produção)
    const logoImg = await loadImageSafe('/logo.png', 2000);
    if (logoImg) {
      try {
        doc.addImage(logoImg, 'PNG', 14, 8, 30, 30);
      } catch (e) {
        console.warn("Could not add image to PDF", e);
      }
    }


    // Company Name and Subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text(COMPANY_INFO.name.toUpperCase(), 50, 22);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Tudo em madeiras brutas e beneficiadas.", 50, 28);

    // Document Type and ID
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const docTitle = `${order.type.toUpperCase()}`;
    doc.text(docTitle, pageWidth - 14, 22, { align: 'right' });

    doc.setFontSize(10);
    const docId = `#${order.id.slice(-6).toUpperCase()}`;
    doc.text(docId, pageWidth - 14, 28, { align: 'right' });

    // Premium Header Details (Use fixed CNPJ if info missing)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const contactInfo = `CNPJ: 08.620.035/0001-35  |  WhatsApp: ${COMPANY_INFO.phoneDisplay}  |  ${COMPANY_INFO.address}`;
    doc.text(contactInfo, 50, 35);

    // Divider Line
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(50, 38, pageWidth - 14, 38);

    // Date and Seller (Just below header)
    doc.setTextColor(grayColor);
    doc.setFontSize(9);
    const dateStr = `Data: ${brasiliaTime.formatDate(order.date)}`;
    doc.text(dateStr, pageWidth - 14, 52, { align: 'right' });

    if (order.sellerName || 'Madeiras Ouro Preto') {
      const sellerStr = `Vendedor: ${order.sellerName || 'Madeiras Ouro Preto'}`;
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
    doc.text(order.clientName || 'Consumidor Final', 26, 76);

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

    doc.setFont('helvetica', 'bold');
    doc.text("Forma de Pagamento:", 14, 91);
    doc.setFont('helvetica', 'normal');
    doc.text(order.paymentMethod || 'Não informada', 50, 91);

    if (order.deliveryDate) {
      doc.setFont('helvetica', 'bold');
      doc.text("Data de Entrega:", 14, 96);
      doc.setFont('helvetica', 'normal');
      const deliveryDate = new Date(order.deliveryDate + 'T12:00:00');
      doc.text(brasiliaTime.formatDate(deliveryDate), 42, 96);
    }

    // Re-adjust startY for the table
    const tableStartY = order.deliveryDate ? 102 : 95;

    const tableColumn = ["Descrição:", "Qtd:", "Comp.:", "Larg.:", "Benef.:", "Un.:", "Vl. Unit.:", "Total:"];
    const tableRows: any[] = [];

    order.items.forEach((item: OrderItem) => {
      const descLower = item.description.toLowerCase();
      const catLower = (item.category || '').toLowerCase();
      const hasCategory = catLower && descLower.includes(catLower);
      
      const description = (item.category && !hasCategory) ? `${item.description} - ${item.category}` : item.description;

      const formatValue = (v: any) => v && !isNaN(v) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

      const itemData = [
        description,
        item.quantity.toString(),
        formatValue(item.comprimento),
        formatValue(item.largura),
        item.isBeneficiado ? 'Benef.' : '-',
        unitLabels[item.unit] || item.unit || 'un',
        `R$ ${(item.unitPrice || 0).toFixed(2)}`,
        `R$ ${(item.total || 0).toFixed(2)}`
      ];
      tableRows.push(itemData);
    });

    autoTable(doc, {
      startY: tableStartY,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        5: { fontStyle: 'bold', halign: 'right' }
      }
    });

    const rightMargin = pageWidth - 14;
    let yPos = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(grayColor);
    doc.text(`Subtotal dos Itens: R$ ${(order.subtotal || 0).toFixed(2)}`, rightMargin, yPos, { align: 'right' });
    yPos += 6;

    if (order.globalDiscountAmount && order.globalDiscountAmount > 0) {
      const discountLabel = order.globalDiscountType === 'percent'
        ? `Desconto do Pedido (${order.globalDiscountValue}%):`
        : 'Desconto do Pedido:';
      doc.text(`${discountLabel} - R$ ${order.globalDiscountAmount.toFixed(2)}`, rightMargin, yPos, { align: 'right' });
      yPos += 6;
    }

    if (order.shippingValue && order.shippingValue > 0) {
      doc.text(`Frete: R$ ${Number(order.shippingValue).toFixed(2)}`, rightMargin, yPos, { align: 'right' });
      yPos += 6;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryColor);
    doc.text(`Total Final: R$ ${(order.total || 0).toFixed(2)}`, rightMargin, yPos + 4, { align: 'right' });

    const notesY = yPos + 15;

    if (order.customerNotes) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("OBSERVAÇÕES:", 14, notesY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitNotes = doc.splitTextToSize(order.customerNotes, pageWidth - 28);
      doc.text(splitNotes, 14, notesY + 6);
    }

    // Signature Area
    const signatureY = pageHeight - 40;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("Assinatura do Cliente: __________________________________________", pageWidth / 2, signatureY, { align: 'center' });

    // Footer
    const footerY = pageHeight - 15;
    doc.setDrawColor(230, 230, 230);
    doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado em: ${brasiliaTime.format(new Date())}  |  CNPJ: 08.620.035/0001-35`, 14, footerY);
    doc.text("Madeiras Ouro Preto - Tudo em madeiras brutas e beneficiadas.", pageWidth - 14, footerY, { align: 'right' });

    const fileName = `OuroPreto_${order.type?.toUpperCase() || 'DOC'}_${order.id?.slice(-6).toUpperCase() || '000000'}.pdf`;

    if (openPrint) {
      window.open(doc.output('bloburl'), '_blank');
    } else {
      doc.save(fileName);
    }
  } catch (error) {
    console.error("Fatal error in PDF generation:", error);
    alert("Erro crítico ao gerar PDF. Tente salvar o pedido primeiro.");
  }
};

