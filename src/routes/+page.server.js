import { ACCESS_TOKEN } from '$env/static/private';

export function load() {
  console.log("running in server", ACCESS_TOKEN);
  return {
    accessToken: ACCESS_TOKEN
  };
}
