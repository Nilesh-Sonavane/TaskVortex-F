import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminProjectEdit } from './admin-project-edit';

describe('AdminProjectEdit', () => {
  let component: AdminProjectEdit;
  let fixture: ComponentFixture<AdminProjectEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProjectEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminProjectEdit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
