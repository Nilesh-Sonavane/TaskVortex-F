import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmployeeReportDetail } from './employee-report-detail';

describe('EmployeeReportDetail', () => {
  let component: EmployeeReportDetail;
  let fixture: ComponentFixture<EmployeeReportDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmployeeReportDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmployeeReportDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
