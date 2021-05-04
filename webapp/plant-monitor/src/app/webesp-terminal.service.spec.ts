import { TestBed } from '@angular/core/testing';

import { WebespTerminalService } from './webesp-terminal.service';

describe('WebespTerminalService', () => {
  let service: WebespTerminalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebespTerminalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
