export const getCurrentLocation = () => {
  if("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((position) => {
      
    })

  } else {
    console.log("Geo Location is not available")
  }
}