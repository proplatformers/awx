import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { withI18n } from '@lingui/react';
import { t } from '@lingui/macro';
import { CredentialsAPI } from '@api';
import { Card, PageSection } from '@patternfly/react-core';
import AlertModal from '@components/AlertModal';
import ErrorDetail from '@components/ErrorDetail';
import DataListToolbar from '@components/DataListToolbar';
import PaginatedDataList, {
  ToolbarAddButton,
  ToolbarDeleteButton,
} from '@components/PaginatedDataList';
import useRequest from '@util/useRequest';
import {
  getQSConfig,
  parseQueryString,
  replaceParams,
  encodeNonDefaultQueryString,
} from '@util/qs';
import { CredentialListItem } from '.';

const QS_CONFIG = getQSConfig('credential', {
  page: 1,
  page_size: 20,
  order_by: 'name',
});

function CredentialList({ i18n }) {
  const [showDeletionError, setShowDeletionError] = useState(false);
  const [selected, setSelected] = useState([]);

  const location = useLocation();
  const history = useHistory();

  const {
    result: { credentials, credentialCount, actions },
    error: contentError,
    isLoading,
    request: fetchCredentials,
  } = useRequest(
    useCallback(async () => {
      const params = parseQueryString(QS_CONFIG, location.search);
      const [creds, credActions] = await Promise.all([
        CredentialsAPI.read(params),
        CredentialsAPI.readOptions(),
      ]);
      return {
        credentials: creds.data.results,
        credentialCount: creds.data.count,
        actions: credActions.data.actions,
      };
    }, [location]),
    {
      credentials: [],
      credentialCount: 0,
      actions: {},
    }
  );

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const {
    isLoading: isDeleteLoading,
    error: deletionError,
    request: deleteCredentials,
  } = useRequest(
    useCallback(async () => {
      return Promise.all(selected.map(({ id }) => CredentialsAPI.destroy(id)));
    }, [selected])
  );

  useEffect(() => {
    if (deletionError) {
      setShowDeletionError(true);
    }
  }, [deletionError]);

  const handleDelete = async () => {
    await deleteCredentials();
    adjustPagination();
    setSelected([]);
  };

  const adjustPagination = () => {
    const params = parseQueryString(QS_CONFIG, location.search);
    if (params.page > 1 && selected.length === credentials.length) {
      const newParams = encodeNonDefaultQueryString(
        QS_CONFIG,
        replaceParams(params, { page: params.page - 1 })
      );
      history.push(`${location.pathname}?${newParams}`);
    } else {
      fetchCredentials();
    }
  };

  const handleSelectAll = isSelected => {
    setSelected(isSelected ? [...credentials] : []);
  };

  const handleSelect = row => {
    if (selected.some(s => s.id === row.id)) {
      setSelected(selected.filter(s => s.id !== row.id));
    } else {
      setSelected(selected.concat(row));
    }
  };

  const canAdd =
    actions && Object.prototype.hasOwnProperty.call(actions, 'POST');
  const isAllSelected =
    selected.length > 0 && selected.length === credentials.length;

  return (
    <PageSection>
      <Card>
        <PaginatedDataList
          contentError={contentError}
          hasContentLoading={isLoading || isDeleteLoading}
          items={credentials}
          itemCount={credentialCount}
          qsConfig={QS_CONFIG}
          onRowClick={handleSelect}
          renderItem={item => (
            <CredentialListItem
              key={item.id}
              credential={item}
              detailUrl={`/credentials/${item.id}/details`}
              isSelected={selected.some(row => row.id === item.id)}
              onSelect={() => handleSelect(item)}
            />
          )}
          renderToolbar={props => (
            <DataListToolbar
              {...props}
              showSelectAll
              isAllSelected={isAllSelected}
              onSelectAll={handleSelectAll}
              qsConfig={QS_CONFIG}
              additionalControls={[
                <ToolbarDeleteButton
                  key="delete"
                  onDelete={handleDelete}
                  itemsToDelete={selected}
                  pluralizedItemName={i18n._(t`Credentials`)}
                />,
                canAdd && (
                  <ToolbarAddButton key="add" linkTo="/credentials/add" />
                ),
              ]}
            />
          )}
        />
      </Card>
      <AlertModal
        isOpen={showDeletionError}
        variant="danger"
        title={i18n._(t`Error!`)}
        onClose={() => setShowDeletionError(false)}
      >
        {i18n._(t`Failed to delete one or more credentials.`)}
        <ErrorDetail error={deletionError} />
      </AlertModal>
    </PageSection>
  );
}

export default withI18n()(CredentialList);
