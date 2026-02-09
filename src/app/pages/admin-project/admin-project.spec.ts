import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProject } from './admin-project';

describe('AdminProject', () => {
  let component: AdminProject;
  let fixture: ComponentFixture<AdminProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProject]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProject);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
