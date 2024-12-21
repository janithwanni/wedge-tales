import { ACCESS_TOKEN } from '$env/static/private';

export function load() {
  return {
    accessToken: ACCESS_TOKEN
  };
}
