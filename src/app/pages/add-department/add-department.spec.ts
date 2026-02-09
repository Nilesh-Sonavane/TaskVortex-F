import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDepartment } from './add-department';

describe('AddDepartment', () => {
  let component: AddDepartment;
  let fixture: ComponentFixture<AddDepartment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDepartment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDepartment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
