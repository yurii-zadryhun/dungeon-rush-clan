import React from 'react';
import './DataTable.css';

interface TableProps {
  label: string;
  headers: React.ReactNode[];
  columns: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}
export function DataTable({
  label,
  headers,
  columns,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = '',
}: TableProps) {
  return (
    <div
      className={['data-table', className].filter(Boolean).join(' ')}
      role="table"
      aria-label={label}
      style={{ '--data-columns': columns } as React.CSSProperties}
    >
      <div className={['data-table-header', headerClassName].filter(Boolean).join(' ')} role="row">
        {headers.map((header, i) => (
          <div role="columnheader" key={i}>
            {header}
          </div>
        ))}
      </div>
      <div role="rowgroup" className={['data-table-body', bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
    </div>
  );
}
export function DataTableRow({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['data-table-row', className].filter(Boolean).join(' ')} role="row">
      {children}
    </div>
  );
}
export function DataTableCell({
  children,
  numeric = false,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className={'data-table-cell' + (numeric ? ' numeric' : '')} role="cell">
      {children}
    </div>
  );
}
