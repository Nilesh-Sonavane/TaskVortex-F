import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDepartmentComponent } from './add-department';

describe('AddDepartment', () => {
  let component: AddDepartmentComponent;
  let fixture: ComponentFixture<AddDepartmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDepartmentComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AddDepartmentComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
