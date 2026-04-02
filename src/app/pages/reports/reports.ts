import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Loader } from '../../components/loader/loader';
import { ProjectService } from '../../services/project-service';
import { ReportService } from '../../services/report';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, Loader, RouterModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {

  private reportService = inject(ReportService);
  private projectService = inject(ProjectService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // --- FILTERS & STATE ---
  selectedYear = signal<string>(new Date().getFullYear().toString());
  selectedMonthVal = signal<string>(String(new Date().getMonth() + 1).padStart(2, '0'));

  // Combined for API
  selectedMonth = computed(() => `${this.selectedYear()}-${this.selectedMonthVal()}`);

  selectedProject = signal<string>('ALL');
  isLoading = signal<boolean>(false);

  // --- DATA SIGNALS ---
  kpiData = signal({ totalPoints: 0, totalLoggedHours: 0, teamEfficiency: 0 });
  employeeReports = signal<any[]>([]);
  projects = signal<any[]>([]);
  years = signal<number[]>([]);

  readonly MONTHS = [
    { value: '01', label: 'January' }, { value: '02', label: 'February' },
    { value: '03', label: 'March' }, { value: '04', label: 'April' },
    { value: '05', label: 'May' }, { value: '06', label: 'June' },
    { value: '07', label: 'July' }, { value: '08', label: 'August' },
    { value: '09', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' }
  ];

  // --- DYNAMIC TITLE (Role Based) ---
  reportTitle = computed(() => {
    const userStr = localStorage.getItem('user_details');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.role === 'ADMIN' ? 'Organization Performance' : 'My Team Velocity';
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }
    return 'Performance Analytics';
  });

  // --- SEARCH & PAGINATION ---
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  filteredReports = computed(() => {
    let reports = this.employeeReports();
    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      reports = reports.filter(r => r.name.toLowerCase().includes(term));
    }
    return reports;
  });

  totalPages = computed(() => Math.ceil(this.filteredReports().length / this.pageSize()) || 1);

  paginatedReports = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredReports().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.generateYearList();
    this.loadProjects();
    this.fetchReportData();
  }

  generateYearList() {
    const startYear = 2023;
    const endYear = new Date().getFullYear() + 1;
    const yearArray: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      yearArray.push(y);
    }
    this.years.set(yearArray.reverse());
  }

  onFilterChange() {
    this.currentPage.set(1);
    this.fetchReportData();
  }

  onSearchChange(term: string) {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  fetchReportData() {
    this.isLoading.set(true);
    const month = this.selectedMonth();
    let project = this.selectedProject();

    if (project === 'ALL') {
      project = '';
    }

    // MATCH THE EXACT SAME KEY HERE
    const userStr = localStorage.getItem('user_details');
    let role = 'EMPLOYEE';
    let userId = 0;

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        role = user.role || 'EMPLOYEE';
        userId = user.id || 0;
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }

    this.reportService.getPerformanceReport(month, project, role, userId).subscribe({
      next: (res) => {
        this.kpiData.set(res.kpiData || { totalPoints: 0, totalLoggedHours: 0, teamEfficiency: 0 });
        this.employeeReports.set(res.employeeReports || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('API Error:', err);
        this.kpiData.set({ totalPoints: 0, totalLoggedHours: 0, teamEfficiency: 0 });
        this.employeeReports.set([]);
        this.isLoading.set(false);
        this.toast.show('Error connecting to server', 'error');
      }
    });
  }

  loadProjects() {
    // 1. Get the logged-in user details
    const userStr = localStorage.getItem('user_details');
    let role = 'EMPLOYEE';
    let userId = 0;

    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        role = user.role || 'EMPLOYEE';
        userId = user.id || 0;
      } catch (e) {
        console.error('Error parsing user data', e);
      }
    }

    // 2. Fetch and filter projects
    this.projectService.getAllProjects().subscribe({
      next: (data: any[]) => {
        if (role === 'ADMIN') {
          // Admin sees all projects
          this.projects.set(data);
        } else if (role === 'MANAGER') {
          // Manager only sees their own projects
          // (Checks both p.managerId and p.manager.id to be safe depending on your JSON structure)
          const myProjects = data.filter(p =>
            p.managerId === userId || (p.manager && p.manager.id === userId)
          );
          this.projects.set(myProjects);
        } else {
          // Employee doesn't manage projects, clear the dropdown
          this.projects.set([]);
        }
      },
      error: (err) => console.error('Failed to load projects', err)
    });
  }

  getEfficiencyColor(efficiency: number): string {
    if (efficiency >= 95) return 'success';
    if (efficiency >= 80) return 'warning';
    return 'danger';
  }

  prevPage() { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }
  nextPage() { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }



  exportReport(format: 'csv' | 'pdf' | 'excel') {
    if (format === 'csv') {
      this.generateCSV();
    } else if (format === 'pdf') {
      this.generatePDF();
    } else if (format === 'excel') {
      this.generateExcel();
    }
  }

  private generateCSV() {
    const data = this.filteredReports();
    if (!data || data.length === 0) return;

    // Professional Headers
    const headers = [
      'Team Member',
      'Tasks Completed',
      'Total Points',
      'Estimated Hours',
      'Logged Hours',
      'Efficiency (%)',
      'Performance Status'
    ];

    const rows = data.map(emp => {
      const status = emp.efficiency >= 95 ? 'EXCELLENT' : (emp.efficiency >= 80 ? 'GOOD' : 'OVER BUDGET');

      // Wrap name in quotes to handle any special characters
      return [
        `"${emp.name}"`,
        emp.tasksCompleted,
        emp.points,
        emp.estHours,
        emp.loggedHours,
        emp.efficiency,
        status
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const monthLabel = this.MONTHS.find(m => m.value === this.selectedMonthVal())?.label || 'Report';

    link.setAttribute('href', url);
    link.setAttribute('download', `Team_Performance_${monthLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private generateExcel() {
    const data = this.filteredReports();
    if (!data || data.length === 0) {
      this.toast.show('No data to export', 'error');
      return;
    }

    // Prepare data with the "Status" logic to match the PDF
    const excelData = data.map(emp => {
      const status = emp.efficiency >= 95 ? 'EXCELLENT' : (emp.efficiency >= 80 ? 'GOOD' : 'OVER BUDGET');

      return {
        'TEAM MEMBER': emp.name.toUpperCase(),
        'TASKS COMPLETED': emp.tasksCompleted,
        'TOTAL POINTS': emp.points,
        'ESTIMATED HOURS': emp.estHours,
        'LOGGED HOURS': emp.loggedHours,
        'EFFICIENCY (%)': emp.efficiency,
        'PERFORMANCE STATUS': status
      };
    });

    // Create Worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set Column Widths for a professional look
    const wscols = [
      { wch: 30 }, // Name
      { wch: 20 }, // Tasks
      { wch: 15 }, // Points
      { wch: 20 }, // Est Hours
      { wch: 20 }, // Logged Hours
      { wch: 15 }, // Efficiency
      { wch: 20 }  // Status
    ];
    worksheet['!cols'] = wscols;

    // Create Workbook and Append
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Performance');

    // Generate File
    const monthLabel = this.MONTHS.find(m => m.value === this.selectedMonthVal())?.label || 'Report';
    XLSX.writeFile(workbook, `Team_Performance_${monthLabel}_${this.selectedYear()}.xlsx`);
  }

  private generatePDF() {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // 1. CORPORATE HEADER (Dark Blue Bar)
    doc.setFillColor(15, 30, 84); // Same Navy Blue as Detail Report
    doc.rect(0, 0, pageWidth, 6, 'F');

    // Title Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text(this.reportTitle().toUpperCase(), 14, 24);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('TaskVortex Management System • Team Analytics Document', 14, 30);

    // Divider Line
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 35, pageWidth - 14, 35);

    // 2. REPORT METADATA (Grid Layout)
    const monthLabel = this.MONTHS.find(m => m.value === this.selectedMonthVal())?.label || 'Unknown';
    const projectName = this.selectedProject() === 'ALL' ? 'All Projects' :
      this.projects().find(p => p.id === this.selectedProject())?.name || 'Selected Project';

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT SCOPE:', 14, 45);
    doc.setTextColor(37, 99, 235); // Corporate Blue
    doc.text(projectName.toUpperCase(), 48, 45);

    doc.setTextColor(15, 23, 42);
    doc.text('BILLING CYCLE:', pageWidth - 70, 45);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`${monthLabel} ${this.selectedYear()}`, pageWidth - 35, 45);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('GENERATED ON:', 14, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('en-GB'), 48, 52);

    // 3. EXECUTIVE KPI SUMMARY BOX (The Gray Box)
    const kpi = this.kpiData();
    doc.setFillColor(248, 250, 252); // Light Gray
    doc.roundedRect(14, 60, pageWidth - 28, 24, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('TEAM POINTS', 25, 68);
    doc.text('TOTAL LOGGED', 85, 68);
    doc.text('TEAM EFFICIENCY', 145, 68);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(`${kpi.totalPoints}`, 25, 78);
    doc.text(`${kpi.totalLoggedHours}h`, 85, 78);

    // Efficiency Color Logic in PDF
    if (kpi.teamEfficiency >= 95) doc.setTextColor(22, 163, 74); // Green
    else if (kpi.teamEfficiency >= 80) doc.setTextColor(217, 119, 6); // Orange
    else doc.setTextColor(220, 38, 38); // Red
    doc.text(`${kpi.teamEfficiency}%`, 145, 78);

    // 4. TEAM BREAKDOWN TABLE
    let currentY = 95;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('TEAM MEMBER PERFORMANCE BREAKDOWN', 14, currentY);

    const data = this.filteredReports();
    const tableRows = data.map(emp => [
      emp.name.toUpperCase(),
      emp.tasksCompleted.toString(),
      emp.points.toString(),
      `${emp.estHours}h / ${emp.loggedHours}h`,
      `${emp.efficiency}%`,
      emp.efficiency >= 95 ? 'EXCELLENT' : (emp.efficiency >= 80 ? 'GOOD' : 'OVER BUDGET')
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [['MEMBER NAME', 'TASKS', 'PTS', 'EST vs LOG', 'EFF %', 'STATUS']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [15, 30, 84], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: 50, fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center', fontStyle: 'bold' },
        5: { halign: 'center' }
      },
      didParseCell: (hookData) => {
        if (hookData.column.index === 4 && hookData.cell.section === 'body') {
          const eff = parseInt(hookData.cell.raw as string);
          if (eff >= 95) hookData.cell.styles.textColor = [22, 163, 74];
          else if (eff < 80) hookData.cell.styles.textColor = [220, 38, 38];
        }
      }
    });

    // 5. FOOTER (Confidentiality & Page Numbers)
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
      doc.text('CONFIDENTIAL - INTERNAL USE ONLY • TASKVORTEX', 14, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
    }

    doc.save(`Team_Performance_Report_${this.selectedMonth()}.pdf`);
  }

  getAvatar(profileUrl: string, userName: String): string {
    if (profileUrl) {
      return profileUrl.startsWith('http') ? profileUrl : `http://localhost:8080${profileUrl}`;
    }
    // Safely encode the name to handle spaces (e.g., "Virat Kohli")
    const encodedName = userName ? encodeURIComponent(userName.toString()) : 'Unknown';
    return `https://ui-avatars.com/api/?name=${encodedName}&background=random&color=fff`;
  }
}