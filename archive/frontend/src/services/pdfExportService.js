import jsPDF from 'jspdf';
import { t } from '../utils/translations';

/**
 * Professional PDF Export Service for Route Reports
 * Generates branded PDF reports with route information and customer details
 */
class PDFExportService {
  constructor() {
    // PDF configuration
    this.config = {
      format: 'a4',
      margin: 20,
      logoMaxWidth: 40,
      logoMaxHeight: 40,
      lineHeight: 7,
      titleFontSize: 18,
      subTitleFontSize: 14,
      bodyFontSize: 10,
      smallFontSize: 8,
      colors: {
        primary: '#1976d2',
        secondary: '#666',
        accent: '#4caf50',
        text: '#333',
        light: '#f5f5f5',
        border: '#e0e0e0'
      }
    };
  }

  /**
   * Generate and download PDF report for a route
   * @param {Object} route - Route data containing waypoints and statistics
   * @param {Array} customers - Array of customer data
   * @param {Object} origin - Origin location data
   */
  async generateRouteReport(route, customers, origin) {
    try {
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Initialize page
      let currentY = this.config.margin;

      // Add header with logo and company branding
      currentY = await this.addHeader(pdf, currentY, pageWidth);

      // Add title
      currentY = this.addTitle(pdf, currentY, pageWidth);

      // Add route summary
      currentY = this.addRouteSummary(pdf, currentY, pageWidth, route, origin);

      // Add route statistics
      currentY = this.addRouteStatistics(pdf, currentY, pageWidth, route);

      // Add customer list in route order
      await this.addCustomerList(pdf, currentY, pageWidth, pageHeight, route, customers);

      // Add footer
      this.addFooter(pdf, pageWidth, pageHeight);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const filename = `Rota_CIA_Maquinas_${timestamp}.pdf`;

      // Save the PDF
      pdf.save(filename);

      return {
        success: true,
        filename,
        message: 'PDF exported successfully'
      };
    } catch (error) {
      console.error('Error generating PDF:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate PDF'
      };
    }
  }

  /**
   * Add header with logo and company branding
   */
  async addHeader(pdf, startY, pageWidth) {
    let logoWidth = 0;
    let logoHeight = 0;

    try {
      // Load and add logo with proper aspect ratio
      const logoData = await this.loadImageWithDimensions('/logo.png');
      const aspectRatio = logoData.width / logoData.height;

      // Calculate logo dimensions maintaining aspect ratio
      if (aspectRatio > 1) {
        // Landscape logo
        logoWidth = Math.min(this.config.logoMaxWidth, 40);
        logoHeight = logoWidth / aspectRatio;
      } else {
        // Portrait or square logo
        logoHeight = Math.min(this.config.logoMaxHeight, 40);
        logoWidth = logoHeight * aspectRatio;
      }

      pdf.addImage(
        logoData.dataUrl,
        'PNG',
        this.config.margin,
        startY,
        logoWidth,
        logoHeight
      );
    } catch (error) {
      console.warn('Could not load logo:', error);
      // Continue without logo - use text fallback
      logoWidth = 0;
      logoHeight = 20;
    }

    // Company name and title
    const textStartX = this.config.margin + logoWidth + 10;
    pdf.setFontSize(16);
    pdf.setTextColor(this.config.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CIA MÁQUINAS', textStartX, startY + 15);

    pdf.setFontSize(12);
    pdf.setTextColor(this.config.colors.secondary);
    pdf.setFont('helvetica', 'normal');
    pdf.text(t('pdf.reportTitle'), textStartX, startY + 22);

    // Date
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    pdf.setFontSize(this.config.smallFontSize);
    pdf.setTextColor(this.config.colors.secondary);
    pdf.text(`${t('pdf.generatedOn')}: ${currentDate}`, pageWidth - this.config.margin - 50, startY + 10);

    // Add separator line
    pdf.setDrawColor(this.config.colors.primary);
    pdf.setLineWidth(0.8);
    pdf.line(this.config.margin, startY + 40, pageWidth - this.config.margin, startY + 40);

    return startY + 50;
  }

  /**
   * Add main title
   */
  addTitle(pdf, startY, pageWidth) {
    pdf.setFontSize(this.config.titleFontSize);
    pdf.setTextColor(this.config.colors.text);
    pdf.setFont('helvetica', 'bold');

    const title = t('pdf.title').toUpperCase();
    const titleWidth = pdf.getStringUnitWidth(title) * this.config.titleFontSize / pdf.internal.scaleFactor;
    const titleX = (pageWidth - titleWidth) / 2;

    pdf.text(title, titleX, startY);

    return startY + 15;
  }

  /**
   * Add route summary section
   */
  addRouteSummary(pdf, startY, pageWidth, route, origin) {
    // Section title
    pdf.setFontSize(this.config.subTitleFontSize);
    pdf.setTextColor(this.config.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('pdf.routeSummary').toUpperCase(), this.config.margin, startY);

    let currentY = startY + 10;

    // Origin information
    pdf.setFontSize(this.config.bodyFontSize);
    pdf.setTextColor(this.config.colors.text);
    pdf.setFont('helvetica', 'normal');

    pdf.text(t('pdf.origin') + ':', this.config.margin, currentY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(origin?.address || t('common.notSpecified'), this.config.margin + 20, currentY);

    currentY += this.config.lineHeight;

    // Route creation time
    pdf.setFont('helvetica', 'normal');
    pdf.text(t('pdf.createdOn') + ':', this.config.margin, currentY);
    pdf.setFont('helvetica', 'bold');
    const creationTime = new Date().toLocaleString('pt-BR');
    pdf.text(creationTime, this.config.margin + 25, currentY);

    return currentY + 15;
  }

  /**
   * Add route statistics
   */
  addRouteStatistics(pdf, startY, pageWidth, route) {
    // Section title
    pdf.setFontSize(this.config.subTitleFontSize);
    pdf.setTextColor(this.config.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('pdf.routeStatistics').toUpperCase(), this.config.margin, startY);

    let currentY = startY + 15;

    // Create statistics boxes with better spacing
    const availableWidth = pageWidth - (2 * this.config.margin);
    const boxSpacing = 8;
    const boxWidth = (availableWidth - (2 * boxSpacing)) / 3;
    const boxHeight = 28;

    const stats = [
      {
        label: t('pdf.totalDistance'),
        value: `${route.totalDistance ? route.totalDistance.toFixed(1) : '0.0'} km`,
        color: '#4caf50'
      },
      {
        label: t('pdf.estimatedTime'),
        value: this.formatTime(route.estimatedTime || 0),
        color: '#ff9800'
      },
      {
        label: t('pdf.totalStops'),
        value: `${Math.max((route.waypoints?.length || 0) - 2, 0)}`,
        color: '#2196f3'
      }
    ];

    stats.forEach((stat, index) => {
      const boxX = this.config.margin + index * (boxWidth + boxSpacing);

      // Draw box with gradient effect
      pdf.setFillColor(248, 249, 250); // Light background
      pdf.setDrawColor(this.config.colors.border);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(boxX, currentY, boxWidth, boxHeight, 3, 3, 'FD');

      // Add colored top border
      const rgb = this.hexToRgb(stat.color);
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.roundedRect(boxX, currentY, boxWidth, 3, 3, 3, 'F');

      // Add label
      pdf.setFontSize(this.config.smallFontSize);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(this.config.colors.secondary);
      const labelX = boxX + boxWidth / 2;
      const labelWidth = pdf.getStringUnitWidth(stat.label) * this.config.smallFontSize / pdf.internal.scaleFactor;
      pdf.text(stat.label, labelX - labelWidth / 2, currentY + 12);

      // Add value
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      const valueWidth = pdf.getStringUnitWidth(stat.value) * 14 / pdf.internal.scaleFactor;
      pdf.text(stat.value, labelX - valueWidth / 2, currentY + 22);
    });

    return currentY + boxHeight + 20;
  }

  /**
   * Draw table header with consistent styling
   */
  drawTableHeader(pdf, headers, columnWidths, tableX, currentY, headerHeight) {
    const primaryRgb = this.hexToRgb(this.config.colors.primary);

    // Set fill and draw colors for header background
    pdf.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    pdf.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    pdf.setLineWidth(0.5);

    // Draw all header cell backgrounds first
    let headerX = tableX;
    headers.forEach((header, index) => {
      pdf.rect(headerX, currentY, columnWidths[index], headerHeight, 'FD');
      headerX += columnWidths[index];
    });

    // Reset position for text rendering
    headerX = tableX;

    // Set text properties AFTER drawing backgrounds
    pdf.setTextColor(255, 255, 255); // White text on blue background
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10); // Explicit font size for headers

    // Draw header text
    headers.forEach((header, index) => {
      const headerWidth = pdf.getStringUnitWidth(header) * 10 / pdf.internal.scaleFactor;
      const headerTextX = headerX + (columnWidths[index] - headerWidth) / 2;
      const headerTextY = currentY + (headerHeight / 2) + 2; // Center vertically with offset
      pdf.text(header, headerTextX, headerTextY);
      headerX += columnWidths[index];
    });
  }

  /**
   * Add customer list in route order
   */
  async addCustomerList(pdf, startY, pageWidth, pageHeight, route, customers) {
    // Section title
    pdf.setFontSize(this.config.subTitleFontSize);
    pdf.setTextColor(this.config.colors.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.text(t('pdf.visitSequence').toUpperCase(), this.config.margin, startY);

    let currentY = startY + 15;

    // Get customers in route order
    const routeCustomers = this.getCustomersInRouteOrder(route, customers);

    // Table headers with improved layout and explicit translations
    const headers = ['Nº', 'Cliente', 'Endereço', 'Cidade', 'Distância'];
    const availableTableWidth = pageWidth - (2 * this.config.margin);
    const columnWidths = [15, 50, 65, 35, 25]; // Better proportions for readability
    // Center the table on the page
    const totalTableWidth = columnWidths.reduce((a, b) => a + b, 0);
    const tableX = (pageWidth - totalTableWidth) / 2;
    const headerHeight = 12; // Increased height for better visibility

    // Draw table header with professional styling
    this.drawTableHeader(pdf, headers, columnWidths, tableX, currentY, headerHeight);

    currentY += headerHeight;

    // Reset text formatting for table content
    pdf.setTextColor(this.config.colors.text);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(this.config.smallFontSize);
    pdf.setDrawColor(this.config.colors.border); // Reset draw color

    routeCustomers.forEach((customer, index) => {
      // Check if we need a new page
      if (currentY > pageHeight - 50) {
        pdf.addPage();
        currentY = this.config.margin;

        // Re-draw table header on new page with consistent styling
        this.drawTableHeader(pdf, headers, columnWidths, tableX, currentY, headerHeight);

        currentY += headerHeight;

        // Reset text formatting for table content
        pdf.setTextColor(this.config.colors.text);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(this.config.smallFontSize);
        pdf.setDrawColor(this.config.colors.border); // Reset draw color
      }

      const rowHeight = 10;

      // Alternate row colors for better readability
      if (index % 2 === 0) {
        pdf.setFillColor(248, 249, 250); // Light gray background
        pdf.rect(tableX, currentY, totalTableWidth, rowHeight, 'F');
      }

      // Draw row borders
      pdf.setDrawColor(this.config.colors.border);
      pdf.setLineWidth(0.3);
      pdf.rect(tableX, currentY, totalTableWidth, rowHeight, 'S');

      // Row data with enhanced formatting
      const rowData = [
        (index + 1).toString(),
        this.truncateText(pdf, customer.name || 'N/A', columnWidths[1] - 6),
        this.truncateText(pdf, customer.street_address || customer.address || 'N/A', columnWidths[2] - 6),
        this.truncateText(pdf, customer.city || 'N/A', columnWidths[3] - 6),
        customer.distanceFromPrevious ? customer.distanceFromPrevious.toFixed(1) + ' km' : '0.0 km'
      ];

      let cellX = tableX;
      rowData.forEach((data, colIndex) => {
        // Improved text alignment per column
        if (colIndex === 0 || colIndex === 4) {
          // Center align sequence number and distance columns
          const dataWidth = pdf.getStringUnitWidth(data) * this.config.smallFontSize / pdf.internal.scaleFactor;
          const centeredX = cellX + (columnWidths[colIndex] - dataWidth) / 2;
          pdf.text(data, centeredX, currentY + rowHeight - 2);
        } else {
          // Left align text columns with proper padding
          pdf.text(data, cellX + 3, currentY + rowHeight - 2);
        }

        // Draw vertical cell borders
        if (colIndex < columnWidths.length - 1) {
          pdf.setDrawColor(this.config.colors.border);
          pdf.setLineWidth(0.2);
          pdf.line(cellX + columnWidths[colIndex], currentY, cellX + columnWidths[colIndex], currentY + rowHeight);
        }

        cellX += columnWidths[colIndex];
      });

      // Row borders are now drawn above in the main row rendering

      currentY += rowHeight;
    });

    return currentY + 10;
  }

  /**
   * Add footer with generation info
   */
  addFooter(pdf, pageWidth, pageHeight) {
    const footerY = pageHeight - 15;

    // Footer line
    pdf.setDrawColor(this.config.colors.secondary);
    pdf.setLineWidth(0.3);
    pdf.line(this.config.margin, footerY - 5, pageWidth - this.config.margin, footerY - 5);

    // Footer text
    pdf.setFontSize(this.config.smallFontSize);
    pdf.setTextColor(this.config.colors.secondary);
    pdf.setFont('helvetica', 'normal');

    const footerText = t('pdf.footer');
    const footerWidth = pdf.getStringUnitWidth(footerText) * this.config.smallFontSize / pdf.internal.scaleFactor;
    const footerX = (pageWidth - footerWidth) / 2;

    pdf.text(footerText, footerX, footerY);

    // Page number
    const pageNum = `${t('pdf.page')} ${pdf.internal.getNumberOfPages()}`;
    pdf.text(pageNum, pageWidth - this.config.margin - 20, footerY);
  }

  /**
   * Count actual customer stops (excluding origin points)
   */
  countCustomerStops(route) {
    if (!route?.waypoints) return 0;

    // Count unique waypoints that are not origin points
    const customerStops = route.waypoints.filter((waypoint, index, arr) => {
      // Exclude origin points (name === 'Origem' or similar)
      if (waypoint.name === 'Origem' || waypoint.name === 'Ponto de Origem') {
        return false;
      }
      // For customer waypoints, count only unique ones with valid id and name
      return waypoint.id && waypoint.name && waypoint.name !== 'Origem';
    });

    return customerStops.length;
  }

  /**
   * Get customers ordered by route sequence
   */
  getCustomersInRouteOrder(route, customers) {
    if (!route?.waypoints || !customers || customers.length === 0) {
      console.warn('Missing route waypoints or customers data');
      return [];
    }

    const routeCustomers = [];
    let previousWaypoint = null;

    // Filter out origin waypoints instead of using slice
    const customerWaypoints = route.waypoints.filter((waypoint, index) => {
      // Exclude origin points by name or isOrigin flag
      if (waypoint.name === 'Origem' || waypoint.name === 'Ponto de Origem' || waypoint.isOrigin) {
        return false;
      }
      // Include waypoints that have customer data
      return waypoint.id && waypoint.name;
    });

    console.log('Processing waypoints:', customerWaypoints.length);
    console.log('Available customers:', customers.length);

    customerWaypoints.forEach((waypoint, index) => {
      // Try multiple ways to match customer
      let customer = customers.find(c => c.id === waypoint.id);

      if (!customer && waypoint.customer_id) {
        customer = customers.find(c => c.id === waypoint.customer_id);
      }

      if (!customer && waypoint.customerId) {
        customer = customers.find(c => c.id === waypoint.customerId);
      }

      // Try matching by name if ID matching fails
      if (!customer && waypoint.name) {
        customer = customers.find(c => c.name && c.name.toLowerCase().includes(waypoint.name.toLowerCase()));
      }

      if (customer) {
        const customerWithDistance = { ...customer };

        // Calculate distance from previous point
        if (previousWaypoint) {
          customerWithDistance.distanceFromPrevious = this.calculateDistance(
            previousWaypoint.lat,
            previousWaypoint.lng,
            waypoint.lat,
            waypoint.lng
          );
        } else {
          // Distance from origin
          customerWithDistance.distanceFromPrevious = this.calculateDistance(
            route.waypoints[0].lat,
            route.waypoints[0].lng,
            waypoint.lat,
            waypoint.lng
          );
        }

        routeCustomers.push(customerWithDistance);
        previousWaypoint = waypoint;
      } else {
        console.warn('Customer not found for waypoint:', waypoint);
      }
    });

    console.log('Matched customers:', routeCustomers.length);
    return routeCustomers;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  /**
   * Format time in minutes to human readable format
   */
  formatTime(minutes) {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  }

  /**
   * Truncate text to fit in column width
   */
  truncateText(pdf, text, maxWidth) {
    if (!text) return '';

    const textWidth = pdf.getStringUnitWidth(text) * this.config.smallFontSize / pdf.internal.scaleFactor;
    if (textWidth <= maxWidth) return text;

    // Truncate and add ellipsis
    let truncated = text;
    while (pdf.getStringUnitWidth(truncated + '...') * this.config.smallFontSize / pdf.internal.scaleFactor > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  /**
   * Load image as base64 with dimensions
   */
  async loadImageWithDimensions(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height
        });
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Load image as base64 (legacy method)
   */
  async loadImage(src) {
    const result = await this.loadImageWithDimensions(src);
    return result.dataUrl;
  }

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
}

// Export singleton instance
const pdfExportService = new PDFExportService();
export default pdfExportService;