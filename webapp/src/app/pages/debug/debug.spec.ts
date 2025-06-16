import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Debug } from './debug';

describe('Debug', () => {
  let component: Debug;
  let fixture: ComponentFixture<Debug>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Debug]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Debug);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
