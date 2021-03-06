import { CommonModule } from '@angular/common';
import { HttpHeaders } from '@angular/common/http';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store, StoreModule } from '@ngrx/store';
import { of as observableOf } from 'rxjs';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { compare, Operation } from 'fast-json-patch';
import {
  GroupRegistryCancelGroupAction,
  GroupRegistryEditGroupAction
} from '../../+admin/admin-access-control/group-registry/group-registry.actions';
import { GroupMock, GroupMock2 } from '../../shared/testing/group-mock';
import { SearchParam } from '../cache/models/search-param.model';
import { CoreState } from '../core.reducers';
import { ChangeAnalyzer } from '../data/change-analyzer';
import { PaginatedList } from '../data/paginated-list';
import { DeleteByIDRequest, DeleteRequest, FindListOptions, PostRequest } from '../data/request.models';
import { RequestEntry } from '../data/request.reducer';
import { RequestService } from '../data/request.service';
import { HttpOptions } from '../dspace-rest-v2/dspace-rest-v2.service';
import { Item } from '../shared/item.model';
import { PageInfo } from '../shared/page-info.model';
import { GroupDataService } from './group-data.service';
import { createSuccessfulRemoteDataObject$ } from '../../shared/remote-data.utils';
import { getMockRemoteDataBuildServiceHrefMap } from '../../shared/mocks/remote-data-build.service.mock';
import { HALEndpointServiceStub } from '../../shared/testing/hal-endpoint-service.stub';
import { TranslateLoaderMock } from '../../shared/testing/translate-loader.mock';
import { getMockRequestService } from '../../shared/mocks/request.service.mock';
import { EPersonMock, EPersonMock2 } from '../../shared/testing/eperson.mock';

describe('GroupDataService', () => {
  let service: GroupDataService;
  let store: Store<CoreState>;
  let requestService: RequestService;

  let restEndpointURL;
  let groupsEndpoint;
  let groups;
  let groups$;
  let halService;
  let rdbService;

  let getRequestEntry$;

  function init() {
    getRequestEntry$ = (successful: boolean) => {
      return observableOf({
        completed: true,
        response: { isSuccessful: successful, payload: groups } as any
      } as RequestEntry)
    };
    restEndpointURL = 'https://dspace.4science.it/dspace-spring-rest/api/eperson';
    groupsEndpoint = `${restEndpointURL}/groups`;
    groups = [GroupMock, GroupMock2];
    groups$ = createSuccessfulRemoteDataObject$(new PaginatedList(new PageInfo(), groups));
    rdbService = getMockRemoteDataBuildServiceHrefMap(undefined, { 'https://dspace.4science.it/dspace-spring-rest/api/eperson/groups': groups$ });
    halService = new HALEndpointServiceStub(restEndpointURL);
    TestBed.configureTestingModule({
      imports: [
        CommonModule,
        StoreModule.forRoot({}),
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: TranslateLoaderMock
          }
        }),
      ],
      declarations: [],
      providers: [],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    });
  }

  function initTestService() {
    return new GroupDataService(
      new DummyChangeAnalyzer() as any,
      null,
      null,
      requestService,
      rdbService,
      store,
      null,
      halService,
      null,
    );
  };

  beforeEach(() => {
    init();
    requestService = getMockRequestService(getRequestEntry$(true));
    store = new Store<CoreState>(undefined, undefined, undefined);
    service = initTestService();
    spyOn(store, 'dispatch');
  });

  describe('searchGroups', () => {
    beforeEach(() => {
      spyOn(service, 'searchBy');
    });

    it('search with empty query', () => {
      service.searchGroups('');
      const options = Object.assign(new FindListOptions(), {
        searchParams: [Object.assign(new SearchParam('query', ''))]
      });
      expect(service.searchBy).toHaveBeenCalledWith('byMetadata', options);
    });

    it('search with query', () => {
      service.searchGroups('test');
      const options = Object.assign(new FindListOptions(), {
        searchParams: [Object.assign(new SearchParam('query', 'test'))]
      });
      expect(service.searchBy).toHaveBeenCalledWith('byMetadata', options);
    });
  });

  describe('deleteGroup', () => {
    beforeEach(() => {
      service.deleteGroup(GroupMock2).subscribe();
    });

    it('should send DeleteRequest', () => {
      const expected = new DeleteByIDRequest(requestService.generateRequestId(), groupsEndpoint + '/' + GroupMock2.uuid, GroupMock2.uuid);
      expect(requestService.configure).toHaveBeenCalledWith(expected);
    });
  });

  describe('addSubGroupToGroup', () => {
    beforeEach(() => {
      service.addSubGroupToGroup(GroupMock, GroupMock2).subscribe();
    });
    it('should send PostRequest to eperson/groups/group-id/subgroups endpoint with new subgroup link in body', () => {
      let headers = new HttpHeaders();
      const options: HttpOptions = Object.create({});
      headers = headers.append('Content-Type', 'text/uri-list');
      options.headers = headers;
      const expected = new PostRequest(requestService.generateRequestId(), GroupMock.self + '/' + service.subgroupsEndpoint, GroupMock2.self, options);
      expect(requestService.configure).toHaveBeenCalledWith(expected);
    });
  });

  describe('deleteSubGroupFromGroup', () => {
    beforeEach(() => {
      service.deleteSubGroupFromGroup(GroupMock, GroupMock2).subscribe();
    });
    it('should send DeleteRequest to eperson/groups/group-id/subgroups/group-id endpoint', () => {
      const expected = new DeleteRequest(requestService.generateRequestId(), GroupMock.self + '/' + service.subgroupsEndpoint + '/' + GroupMock2.id);
      expect(requestService.configure).toHaveBeenCalledWith(expected);
    });
  });

  describe('addMemberToGroup', () => {
    beforeEach(() => {
      service.addMemberToGroup(GroupMock, EPersonMock2).subscribe();
    });
    it('should send PostRequest to eperson/groups/group-id/epersons endpoint with new eperson member in body', () => {
      let headers = new HttpHeaders();
      const options: HttpOptions = Object.create({});
      headers = headers.append('Content-Type', 'text/uri-list');
      options.headers = headers;
      const expected = new PostRequest(requestService.generateRequestId(), GroupMock.self + '/' + service.ePersonsEndpoint, EPersonMock2.self, options);
      expect(requestService.configure).toHaveBeenCalledWith(expected);
    });
  });

  describe('deleteMemberFromGroup', () => {
    beforeEach(() => {
      service.deleteMemberFromGroup(GroupMock, EPersonMock).subscribe();
    });
    it('should send DeleteRequest to eperson/groups/group-id/epersons/eperson-id endpoint', () => {
      const expected = new DeleteRequest(requestService.generateRequestId(), GroupMock.self + '/' + service.ePersonsEndpoint + '/' + EPersonMock.id);
      expect(requestService.configure).toHaveBeenCalledWith(expected);
    });
  });

  describe('editGroup', () => {
    it('should dispatch a EDIT_GROUP action with the groupp to start editing', () => {
      service.editGroup(GroupMock);
      expect(store.dispatch).toHaveBeenCalledWith(new GroupRegistryEditGroupAction(GroupMock));
    });
  });

  describe('cancelEditGroup', () => {
    it('should dispatch a CANCEL_EDIT_GROUP action', () => {
      service.cancelEditGroup();
      expect(store.dispatch).toHaveBeenCalledWith(new GroupRegistryCancelGroupAction());
    });
  });
});

class DummyChangeAnalyzer implements ChangeAnalyzer<Item> {
  diff(object1: Item, object2: Item): Operation[] {
    return compare((object1 as any).metadata, (object2 as any).metadata);
  }
}
