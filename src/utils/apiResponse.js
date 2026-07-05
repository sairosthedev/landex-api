export function success(data, message) {
  const response = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  if (message) response.message = message;
  return response;
}

export function pageResponse(content, page, size, totalElements) {
  const totalPages = Math.ceil(totalElements / size) || 0;
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: page === 0,
    last: page >= totalPages - 1,
  };
}

export function parsePagination(query) {
  const page = Math.max(0, parseInt(query.page || '0', 10));
  const size = Math.min(100, Math.max(1, parseInt(query.size || '20', 10)));
  const sortBy = query.sortBy || 'createdAt';
  const sortDir = (query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;
  return { page, size, sortBy, sortDir, skip: page * size };
}

export function resolveSortField(sortBy, aliases = {}) {
  const field = aliases[sortBy] || sortBy;
  const allowed = ['createdAt', 'askingPrice', 'areaSqm', 'title', 'publishedAt', 'viewCount', 'updatedAt'];
  return allowed.includes(field) ? field : 'createdAt';
}
