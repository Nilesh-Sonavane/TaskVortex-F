import { TestBed } from '@angular/core/testing';

import { TimeLogService } from './time-log-service';

describe('TimeLogService', () => {
  let service: TimeLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeLogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
