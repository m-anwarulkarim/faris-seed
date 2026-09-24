import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

import type { Order } from "@/data/orders";

export type InvoiceStyle = "modern" | "professional" | "minimal";

/**
 * Generates and downloads a PDF invoice for a given order.
 */
export async function generateInvoicePDF(order: Order, style: InvoiceStyle = "modern") {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let y = margin;

  // Colors & Styles based on theme
  const colors = {
    primary: style === "minimal" ? [0, 0, 0] : [34, 73, 58], // Forest Green (#22493A)
    accent: [194, 120, 50], // Earthy Terracotta/Mustard
    text: [0, 0, 0],
    muted: [100, 100, 100],
    border: [200, 200, 200],
  };

  // 1. Header Section
  if (style === "professional") {
    // Professional: Structured header with a divider
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(colors.primary[0] || 0, colors.primary[1] || 0, colors.primary[2] || 0);
    doc.text("FARIS SEED", margin, y);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.muted[0] || 100, colors.muted[1] || 100, colors.muted[2] || 100);
    doc.text("Premium D2C Seed Brand", margin, y + 6);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", pageWidth - margin, y, { align: "right" });
    
    y += 15;
    doc.setDrawColor(colors.primary[0] || 0, colors.primary[1] || 0, colors.primary[2] || 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  } else if (style === "minimal") {
    // Minimal: Simple and clean
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("FARIS SEED", margin, y);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("INVOICE", pageWidth - margin, y, { align: "right" });
    
    y += 20;
  } else {
    // Modern (Default): Circular logo vibe or accent colors
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(colors.primary[0] || 0, colors.primary[1] || 0, colors.primary[2] || 0);
    doc.text("FARIS SEED", margin, y);
    
    doc.setFontSize(14);
    doc.setTextColor(colors.accent[0] || 0, colors.accent[1] || 0, colors.accent[2] || 0);
    doc.text("Invoice", pageWidth - margin, y, { align: "right" });
    
    y += 10;
    doc.setDrawColor(colors.border[0] || 0, colors.border[1] || 0, colors.border[2] || 0);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }


  // 2. Info Section (Bill to / Order Info)
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  if (style === "minimal") {
    doc.setFont("helvetica", "bold");
    doc.text("BILL TO", margin, y);
    doc.text("ORDER INFO", margin + 100, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(order.customerName, margin, y);
    doc.text(`Order ID: ${order.id}`, margin + 100, y);
    y += 5;
    doc.text(order.phone, margin, y);
    doc.text(`Date: ${format(new Date(order.createdAt), "dd MMM yyyy")}`, margin + 100, y);
    y += 5;
    if (order.altPhone) {
      doc.text(`Alt: ${order.altPhone}`, margin, y);
      y += 5;
    }
    const addr = doc.splitTextToSize(order.address, 80);
    doc.text(addr, margin, y);
    y += (addr.length * 5) + 10;
  } else {
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", margin, y);
    doc.text("Order Summary:", margin + 100, y);
    
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(order.customerName, margin, y);
    doc.text(`Order ID: ${order.id}`, margin + 100, y);
    
    y += 5;
    doc.text(order.phone, margin, y);
    doc.text(`Date: ${format(new Date(order.createdAt), "dd MMM yyyy")}`, margin + 100, y);
    
    y += 5;
    if (order.altPhone) {
      doc.text(`Alt Phone: ${order.altPhone}`, margin, y);
      y += 5;
    }
    const addressLines = doc.splitTextToSize(order.address, 80);
    doc.text(addressLines, margin, y);
    y += (addressLines.length * 5) + 10;
  }

  // 3. Items Table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Product", "Quantity", "Unit Price", "Total"]],
    body: [
      [
        order.productName,
        order.quantity.toString(),
        `${order.unitPrice} TK`,
        `${order.unitPrice * order.quantity} TK`,
      ],
    ],
    headStyles: {
      fillColor: style === "minimal" ? [240, 240, 240] : (colors.primary as [number, number, number]),
      textColor: style === "minimal" ? [0, 0, 0] : [255, 255, 255],
      fontStyle: "bold",
    },

    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", cellWidth: 40 },
      3: { halign: "right", cellWidth: 40 },
    },
    theme: style === "minimal" ? "plain" : "striped",
  });

  // 4. Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  
  doc.text("Subtotal:", pageWidth - margin - 40, finalY, { align: "right" });
  doc.text(`${order.unitPrice * order.quantity} TK`, pageWidth - margin, finalY, { align: "right" });
  
  doc.text("Delivery Charge:", pageWidth - margin - 40, finalY + 7, { align: "right" });
  doc.text(`${order.deliveryCharge} TK`, pageWidth - margin, finalY + 7, { align: "right" });
  
  // Total Line
  doc.setDrawColor(colors.border[0] || 200, colors.border[1] || 200, colors.border[2] || 200);
  doc.line(pageWidth - margin - 60, finalY + 11, pageWidth - margin, finalY + 11);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total Amount:", pageWidth - margin - 40, finalY + 18, { align: "right" });
  doc.text(`${order.total} TK`, pageWidth - margin, finalY + 18, { align: "right" });

  // 5. Payment Note
  y = finalY + 30;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method: Cash on Delivery", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Please pay the exact amount to the delivery person upon receiving your package.", margin, y + 5);

  // 6. Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(colors.muted[0] || 100, colors.muted[1] || 100, colors.muted[2] || 100);
  const footerY = doc.internal.pageSize.height - 20;
  
  if (style !== "minimal") {
    doc.setDrawColor(colors.border[0] || 200, colors.border[1] || 200, colors.border[2] || 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  }
  
  doc.text("Thank you for choosing FARIS SEED!", pageWidth / 2, footerY, { align: "center" });
  doc.text("Chand Mia, Housing, Mohammadpur, Dhaka-1207", pageWidth / 2, footerY + 4, { align: "center" });
  doc.text("Phone: +8801897492635 | Email: shopfaris01@gmail.com", pageWidth / 2, footerY + 8, { align: "center" });


  // Save the PDF
  doc.save(`Invoice-${order.id}-${style}.pdf`);
}
