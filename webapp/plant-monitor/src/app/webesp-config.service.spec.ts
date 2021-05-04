import { TestBed } from '@angular/core/testing';

import { WebespConfigService } from './webesp-config.service';

describe('WebespConfigService', () => {
  let service: WebespConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebespConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
