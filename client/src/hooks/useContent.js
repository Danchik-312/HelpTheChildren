import { useEffect, useState } from 'react';
import { contentRepository } from '../services/contentRepository';

export function useCollection(collection, params) {
  const paramsKey = JSON.stringify(params || {});
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ data: [], loading: true, error: null });
    contentRepository.list(collection, JSON.parse(paramsKey))
      .then(data => active && setState({ data, loading: false, error: null }))
      .catch(error => active && setState({ data: [], loading: false, error }));
    return () => { active = false; };
  }, [collection, paramsKey]);
  return state;
}

export function usePaginatedCollection(collection, params) {
  const paramsKey = JSON.stringify(params || {});
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState(current => ({ ...current, loading: true, error: null }));
    contentRepository.listPage(collection, JSON.parse(paramsKey))
      .then(result => active && setState({ data: result.items, meta: result.meta, loading: false, error: null }))
      .catch(error => active && setState({ data: [], meta: null, loading: false, error }));
    return () => { active = false; };
  }, [collection, paramsKey]);
  return state;
}

export function useEntry(collection, slug) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: null });
    contentRepository.findBySlug(collection, slug)
      .then(data => active && setState({ data, loading: false, error: null }))
      .catch(error => active && setState({ data: null, loading: false, error }));
    return () => { active = false; };
  }, [collection, slug]);
  return state;
}

export function useSite() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    contentRepository.site().then(data => active && setState({ data, loading: false, error: null })).catch(error => active && setState({ data: null, loading: false, error }));
    return () => { active = false; };
  }, []);
  return state;
}

export function useHomepage() {
  const [state, setState] = useState({ data: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    contentRepository.homepage().then(data => active && setState({ data, loading: false, error: null })).catch(error => active && setState({ data: [], loading: false, error }));
    return () => { active = false; };
  }, []);
  return state;
}
