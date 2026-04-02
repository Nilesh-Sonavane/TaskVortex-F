import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportService } from '../../services/report';

@Component({
  selector: 'app-employee-report-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-report-detail.html',
  styleUrls: ['./employee-report-detail.css']
})
export class EmployeeReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private reportService = inject(ReportService);

  id: string | null = null;
  selectedMonth = signal<string>(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  isCurrentMonth = computed(() => {
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return this.selectedMonth() === currentMonthStr;
  });

  isExporting = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  employee = signal<any>(null);
  employeeHeader = signal<any>(null);
  tasks = signal<any[]>([]);
  timeLogs = signal<any[]>([]);

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id) {
      this.loadEmployeeDetail();
    }
  }

  loadEmployeeDetail() {
    this.isLoading.set(true);
    this.reportService.getEmployeeDetail(this.id!, this.selectedMonth()).subscribe({
      next: (res) => {
        this.employee.set(res.user);
        this.employeeHeader.set(res.header);
        this.tasks.set(res.tasks || []);
        this.timeLogs.set(res.logs || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('API Error:', err);
      }
    });
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 95) return 'success';
    if (efficiency >= 80) return 'warning';
    return 'danger';
  }

  // Updated to use the header data from backend for consistency
  getTotalPoints(): number {
    return this.employeeHeader()?.totalPoints || 0;
  }

  getTotalLoggedHours(): number {
    // This correctly sums all logs regardless of task status
    return this.timeLogs().reduce((acc, curr) => acc + (curr.hours || 0), 0);
  }

  goBack() {
    window.history.back();
  }

  changeMonth(offset: number) {
    const [year, month] = this.selectedMonth().split('-').map(Number);
    const date = new Date(year, (month - 1) + offset, 1);
    const nextYear = date.getFullYear();
    const nextMonthNum = date.getMonth() + 1;

    const today = new Date();
    if (nextYear > today.getFullYear() || (nextYear === today.getFullYear() && nextMonthNum > (today.getMonth() + 1))) {
      return;
    }

    const nextMonth = nextMonthNum.toString().padStart(2, '0');
    this.selectedMonth.set(`${nextYear}-${nextMonth}`);
    this.loadEmployeeDetail();
  }

  getAvatar(user: any): string {
    if (!user) return 'https://ui-avatars.com/api/?name=?...&background=ccc';
    const currentUrl = user.profileUrl;
    if (currentUrl) {
      if (currentUrl.startsWith('http')) return currentUrl;
      return `http://localhost:8080${currentUrl.startsWith('/') ? '' : '/'}${currentUrl}`;
    }
    const encodedName = encodeURIComponent(`${user.firstName} ${user.lastName}`);
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&color=fff`;
  }

  exportToPDF() {
    this.isExporting.set(true);

    const emp = this.employee();
    const header = this.employeeHeader();
    const fullName = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim().toUpperCase();

    // Safely grab email and phone (checking common property names)
    const email = emp?.email || 'N/A';
    const phone = emp?.phone || emp?.phoneNumber || 'N/A';

    const fileName = `${emp?.firstName}_Performance_Report_${this.selectedMonth()}.pdf`;

    const [year, monthNum] = this.selectedMonth().split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedCycle = `${monthNames[parseInt(monthNum, 10) - 1]}-${year}`;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. CORPORATE HEADER
    doc.setFillColor(15, 30, 84);
    doc.rect(0, 0, pageWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text('EMPLOYEE PERFORMANCE REPORT', 14, 24);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('TaskVortex Management System • Internal HR Document', 14, 30);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 35, pageWidth - 14, 35);

    // 2. DETAILS
    doc.setFontSize(10);

    // Row 1: Name and Billing Cycle
    doc.setTextColor(15, 23, 42);
    doc.text('EMPLOYEE NAME:', 14, 45);
    doc.setTextColor(37, 99, 235);
    doc.text(fullName, 48, 45);

    doc.setTextColor(15, 23, 42);
    doc.text('BILLING CYCLE:', pageWidth - 70, 45);
    doc.setTextColor(71, 85, 105);
    doc.text(formattedCycle, pageWidth - 35, 45);

    // Row 2: Email and Phone (NEW)
    doc.setTextColor(15, 23, 42);
    doc.text('EMAIL ADDRESS:', 14, 52);
    doc.setTextColor(71, 85, 105);
    doc.text(email, 48, 52);

    doc.setTextColor(15, 23, 42);
    doc.text('PHONE NUMBER:', pageWidth - 70, 52);
    doc.setTextColor(71, 85, 105);
    doc.text(phone, pageWidth - 35, 52);

    // 3. EXECUTIVE KPI SUMMARY (Shifted down from Y=60 to Y=65 to make room)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 65, pageWidth - 28, 24, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('TASKS COMPLETED', 20, 73);
    doc.text('POINTS EARNED', 75, 73);
    doc.text('TOTAL HOURS', 130, 73);
    doc.text('EFFICIENCY', 175, 73);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`${header?.completedCount || 0}`, 20, 83);
    doc.setTextColor(37, 99, 235);
    doc.text(`${header?.totalPoints || 0}`, 75, 83);
    doc.setTextColor(15, 23, 42);
    doc.text(`${this.getTotalLoggedHours()}h`, 130, 83);
    doc.text(`${header?.efficiency || 0}%`, 175, 83);

    // Shifted currentY down from 95 to 100
    let currentY = 100;

    // 4. TASKS TABLE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DELIVERABLES BREAKDOWN', 14, currentY);

    const taskRows = this.tasks().map(t => [
      (t.title || 'N/A'),
      t.projectName || 'N/A',
      (t.points || 0).toString(),
      (t.status || 'N/A').replace(/_/g, ' '),
      (t.loggedHours || 0) + 'h'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Task Name', 'Project', 'Points', 'Status', 'Logged']],
      body: taskRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 30, 84], textColor: 255 },
      margin: { left: 14, right: 14 }
    });

    // 5. TIME LOGS TABLE
    currentY = (doc as any).lastAutoTable.finalY + 15;
    if (currentY > pageHeight - 40) { doc.addPage(); currentY = 20; }

    doc.text('DETAILED TIME LOGS', 14, currentY);
    const logRows = this.timeLogs().map(l => [
      l.date || 'N/A',
      l.taskTitle || 'N/A',
      (l.hours || 0) + 'h',
      l.description || 'N/A'
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['Date', 'Task', 'Hours', 'Description']],
      body: logRows,
      theme: 'striped',
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42] },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('CONFIDENTIAL - TASKVORTEX INTERNAL', 14, pageHeight - 10);
        doc.text(`Page ${data.pageNumber}`, pageWidth - 25, pageHeight - 10);
      }
    });

    doc.save(fileName);
    this.isExporting.set(false);
  }
}