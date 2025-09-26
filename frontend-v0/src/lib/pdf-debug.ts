/**
 * PDF Export Debug Helper
 * This file helps debug PDF generation issues
 */

import jsPDF from 'jspdf';

interface DebugResult {
  success: boolean;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Test basic jsPDF functionality
 */
export function testBasicPDF(): DebugResult {
  try {
    console.log('🔧 Testing basic PDF functionality...');

    const pdf = new jsPDF('portrait', 'mm', 'a4');

    // Test basic text
    pdf.setFontSize(16);
    pdf.text('Test PDF Generation', 20, 30);

    // Test if save method exists and works
    const blob = pdf.output('blob');

    if (blob.size > 0) {
      console.log('✅ Basic PDF test successful');
      return {
        success: true,
        message: 'Basic PDF generation works',
        details: {
          blobSize: blob.size,
          jsPDFVersion: (jsPDF as any).version || 'unknown'
        }
      };
    } else {
      return {
        success: false,
        message: 'PDF blob is empty',
        error: 'Generated PDF has no content'
      };
    }
  } catch (error) {
    console.error('❌ Basic PDF test failed:', error);
    return {
      success: false,
      message: 'Basic PDF test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test PDF download functionality
 */
export function testPDFDownload(): DebugResult {
  try {
    console.log('🔧 Testing PDF download functionality...');

    const pdf = new jsPDF('portrait', 'mm', 'a4');
    pdf.setFontSize(16);
    pdf.text('Download Test PDF', 20, 30);
    pdf.text('Generated at: ' + new Date().toISOString(), 20, 40);

    // Test save method
    const filename = `test-pdf-${Date.now()}.pdf`;
    pdf.save(filename);

    console.log('✅ PDF download initiated');
    return {
      success: true,
      message: 'PDF download test initiated',
      details: {
        filename,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('❌ PDF download test failed:', error);
    return {
      success: false,
      message: 'PDF download test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test image loading functionality
 */
export async function testImageLoading(): Promise<DebugResult> {
  try {
    console.log('🔧 Testing image loading functionality...');

    // Test with a simple data URI image
    const testImageDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const pdf = new jsPDF('portrait', 'mm', 'a4');

    // Try to add the test image
    pdf.addImage(testImageDataUri, 'PNG', 20, 20, 10, 10);
    pdf.text('Image Test', 20, 40);

    const blob = pdf.output('blob');

    if (blob.size > 1000) { // Assuming image adds some size
      console.log('✅ Image loading test successful');
      return {
        success: true,
        message: 'Image loading works',
        details: {
          blobSize: blob.size
        }
      };
    } else {
      return {
        success: false,
        message: 'Image may not have been loaded properly',
        details: {
          blobSize: blob.size
        }
      };
    }
  } catch (error) {
    console.error('❌ Image loading test failed:', error);
    return {
      success: false,
      message: 'Image loading test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test PDF with mock route data
 */
export function testPDFWithMockData(): DebugResult {
  try {
    console.log('🔧 Testing PDF with mock route data...');

    const pdf = new jsPDF('portrait', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Header
    pdf.setFontSize(18);
    pdf.setTextColor('#1976d2');
    pdf.text('CIA MÁQUINAS', 20, 30);

    pdf.setFontSize(12);
    pdf.setTextColor('#666');
    pdf.text('Relatório de Rota Otimizada', 20, 40);

    // Date
    pdf.setFontSize(8);
    pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 50, 30);

    // Separator line
    pdf.setDrawColor('#1976d2');
    pdf.setLineWidth(0.8);
    pdf.line(20, 50, pageWidth - 20, 50);

    // Title
    pdf.setFontSize(16);
    pdf.setTextColor('#333');
    pdf.text('RELATÓRIO DE ROTA OTIMIZADA', 20, 70);

    // Mock statistics
    const stats = [
      { label: 'Distância Total', value: '15.5 km', color: '#4caf50' },
      { label: 'Tempo Estimado', value: '45min', color: '#ff9800' },
      { label: 'Total de Paradas', value: '5', color: '#2196f3' }
    ];

    let currentY = 90;
    stats.forEach((stat, index) => {
      const boxX = 20 + index * 60;
      const boxWidth = 50;
      const boxHeight = 25;

      // Draw box
      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor('#e0e0e0');
      pdf.rect(boxX, currentY, boxWidth, boxHeight, 'FD');

      // Add label and value
      pdf.setFontSize(8);
      pdf.setTextColor('#666');
      pdf.text(stat.label, boxX + 2, currentY + 10);

      pdf.setFontSize(12);
      pdf.setTextColor('#333');
      pdf.text(stat.value, boxX + 2, currentY + 18);
    });

    // Mock customer table
    currentY += 40;
    pdf.setFontSize(14);
    pdf.setTextColor('#1976d2');
    pdf.text('SEQUÊNCIA DE VISITAS', 20, currentY);

    currentY += 15;

    // Table header
    const headers = ['Nº', 'Cliente', 'Endereço', 'Cidade'];
    const columnWidths = [15, 50, 65, 35];
    const tableX = 20;
    const headerHeight = 12;

    // Draw header background
    pdf.setFillColor('#1976d2');
    pdf.rect(tableX, currentY, columnWidths.reduce((a, b) => a + b, 0), headerHeight, 'F');

    // Header text
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    let headerX = tableX;
    headers.forEach((header, index) => {
      pdf.text(header, headerX + 3, currentY + 8);
      headerX += columnWidths[index];
    });

    currentY += headerHeight;

    // Mock data rows
    const mockCustomers = [
      { name: 'Cliente Teste 1', address: 'Rua Teste, 123', city: 'São Paulo' },
      { name: 'Cliente Teste 2', address: 'Av. Exemplo, 456', city: 'Campinas' },
      { name: 'Cliente Teste 3', address: 'Rua Demo, 789', city: 'Santos' }
    ];

    pdf.setTextColor('#333');
    pdf.setFontSize(8);

    mockCustomers.forEach((customer, index) => {
      const rowHeight = 10;

      // Alternate row colors
      if (index % 2 === 0) {
        pdf.setFillColor(248, 249, 250);
        pdf.rect(tableX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      }

      // Row data
      const rowData = [
        (index + 1).toString(),
        customer.name,
        customer.address,
        customer.city
      ];

      let cellX = tableX;
      rowData.forEach((data, colIndex) => {
        pdf.text(data, cellX + 3, currentY + 7);
        cellX += columnWidths[colIndex];
      });

      currentY += rowHeight;
    });

    // Footer
    const footerY = pdf.internal.pageSize.getHeight() - 15;
    pdf.setDrawColor('#666');
    pdf.setLineWidth(0.3);
    pdf.line(20, footerY - 5, pageWidth - 20, footerY - 5);

    pdf.setFontSize(8);
    pdf.setTextColor('#666');
    pdf.text('Documento gerado pelo sistema de otimização de rotas CIA Máquinas', 20, footerY);

    const blob = pdf.output('blob');

    if (blob.size > 5000) { // Should be a decent sized PDF
      console.log('✅ Mock data PDF test successful');
      return {
        success: true,
        message: 'Mock data PDF generation works',
        details: {
          blobSize: blob.size,
          customerCount: mockCustomers.length
        }
      };
    } else {
      return {
        success: false,
        message: 'Mock data PDF seems too small',
        details: {
          blobSize: blob.size
        }
      };
    }
  } catch (error) {
    console.error('❌ Mock data PDF test failed:', error);
    return {
      success: false,
      message: 'Mock data PDF test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run comprehensive PDF debug tests
 */
export async function runPDFDebugTests(): Promise<{
  overall: boolean;
  results: Record<string, DebugResult>;
}> {
  console.log('🚀 Starting comprehensive PDF debug tests...');

  const results: Record<string, DebugResult> = {};

  // Test 1: Basic PDF functionality
  results.basicPDF = testBasicPDF();

  // Test 2: PDF download
  results.pdfDownload = testPDFDownload();

  // Test 3: Image loading
  results.imageLoading = await testImageLoading();

  // Test 4: Mock data PDF
  results.mockDataPDF = testPDFWithMockData();

  const overall = Object.values(results).every(result => result.success);

  console.log('📊 Debug test results:', results);
  console.log(`Overall status: ${overall ? '✅ PASS' : '❌ FAIL'}`);

  return { overall, results };
}