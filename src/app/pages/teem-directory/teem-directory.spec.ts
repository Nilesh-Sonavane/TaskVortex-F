import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeemDirectory } from './teem-directory';

describe('TeemDirectory', () => {
  let component: TeemDirectory;
  let fixture: ComponentFixture<TeemDirectory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeemDirectory]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TeemDirectory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
