import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamDirectory } from './teem-directory';

describe('TeemDirectory', () => {
  let component: TeamDirectory;
  let fixture: ComponentFixture<TeamDirectory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamDirectory]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TeamDirectory);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
