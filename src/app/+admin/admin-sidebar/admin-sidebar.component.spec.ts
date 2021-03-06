import { async, ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Injector, NO_ERRORS_SCHEMA } from '@angular/core';
import { AdminSidebarComponent } from './admin-sidebar.component';
import { MenuService } from '../../shared/menu/menu.service';
import { MenuServiceStub } from '../../shared/testing/menu-service.stub';
import { CSSVariableService } from '../../shared/sass-helper/sass-helper.service';
import { CSSVariableServiceStub } from '../../shared/testing/css-variable-service.stub';
import { AuthServiceStub } from '../../shared/testing/auth-service.stub';
import { AuthService } from '../../core/auth/auth.service';

import { of as observableOf } from 'rxjs';
import { By } from '@angular/platform-browser';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

describe('AdminSidebarComponent', () => {
  let comp: AdminSidebarComponent;
  let fixture: ComponentFixture<AdminSidebarComponent>;
  const menuService = new MenuServiceStub();

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule],
      declarations: [AdminSidebarComponent],
      providers: [
        { provide: Injector, useValue: {} },
        { provide: MenuService, useValue: menuService },
        { provide: CSSVariableService, useClass: CSSVariableServiceStub },
        { provide: AuthService, useClass: AuthServiceStub },
        {
          provide: NgbModal, useValue: {
            open: () => {/*comment*/}
          }
        }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).overrideComponent(AdminSidebarComponent, {
      set: {
        changeDetection: ChangeDetectionStrategy.Default,
      }
    }).compileComponents();
  }));

  beforeEach(() => {
    spyOn(menuService, 'getMenuTopSections').and.returnValue(observableOf([]));
    fixture = TestBed.createComponent(AdminSidebarComponent);
    comp = fixture.componentInstance; // SearchPageComponent test instance
    comp.sections = observableOf([]);
    fixture.detectChanges();
  });

  describe('startSlide', () => {
    describe('when expanding', () => {
      beforeEach(() => {
        comp.sidebarClosed = true;
        comp.startSlide({ toState: 'expanded' } as any);
      });

      it('should set the sidebarClosed to false', () => {
        expect(comp.sidebarClosed).toBeFalsy();
      })
    });

    describe('when collapsing', () => {
      beforeEach(() => {
        comp.sidebarClosed = false;
        comp.startSlide({ toState: 'collapsed' } as any);
      });

      it('should set the sidebarOpen to false', () => {
        expect(comp.sidebarOpen).toBeFalsy();
      })
    })
  });

  describe('finishSlide', () => {
    describe('when expanding', () => {
      beforeEach(() => {
        comp.sidebarClosed = true;
        comp.startSlide({ fromState: 'expanded' } as any);
      });

      it('should set the sidebarClosed to true', () => {
        expect(comp.sidebarClosed).toBeTruthy();
      })
    });

    describe('when collapsing', () => {
      beforeEach(() => {
        comp.sidebarClosed = false;
        comp.startSlide({ fromState: 'collapsed' } as any);
      });

      it('should set the sidebarOpen to true', () => {
        expect(comp.sidebarOpen).toBeTruthy();
      })
    })
  });

  describe('when the collapse icon is clicked', () => {
    beforeEach(() => {
      spyOn(menuService, 'toggleMenu');
      const sidebarToggler = fixture.debugElement.query(By.css('#sidebar-collapse-toggle')).query(By.css('a.shortcut-icon'));
      sidebarToggler.triggerEventHandler('click', {
        preventDefault: () => {/**/
        }
      });
    });

    it('should call toggleMenu on the menuService', () => {
      expect(menuService.toggleMenu).toHaveBeenCalled();
    });
  });

  describe('when the collapse link is clicked', () => {
    beforeEach(() => {
      spyOn(menuService, 'toggleMenu');
      const sidebarToggler = fixture.debugElement.query(By.css('#sidebar-collapse-toggle')).query(By.css('.sidebar-collapsible')).query(By.css('a'));
      sidebarToggler.triggerEventHandler('click', {
        preventDefault: () => {/**/
        }
      });
    });

    it('should call toggleMenu on the menuService', () => {
      expect(menuService.toggleMenu).toHaveBeenCalled();
    });
  });

  describe('when the the mouse enters the nav tag', () => {
    it('should call expandPreview on the menuService after 100ms', fakeAsync(() => {
      spyOn(menuService, 'expandMenuPreview');
      const sidebarToggler = fixture.debugElement.query(By.css('nav.navbar'));
      sidebarToggler.triggerEventHandler('mouseenter', {
        preventDefault: () => {/**/
        }
      });
      tick(99);
      expect(menuService.expandMenuPreview).not.toHaveBeenCalled();
      tick(1);
      expect(menuService.expandMenuPreview).toHaveBeenCalled();
    }));
  });

  describe('when the the mouse leaves the nav tag', () => {
    it('should call collapseMenuPreview on the menuService after 400ms', fakeAsync(() => {
      spyOn(menuService, 'collapseMenuPreview');
      const sidebarToggler = fixture.debugElement.query(By.css('nav.navbar'));
      sidebarToggler.triggerEventHandler('mouseleave', {
        preventDefault: () => {/**/
        }
      });
      tick(399);
      expect(menuService.collapseMenuPreview).not.toHaveBeenCalled();
      tick(1);
      expect(menuService.collapseMenuPreview).toHaveBeenCalled();
    }));
  });
});
