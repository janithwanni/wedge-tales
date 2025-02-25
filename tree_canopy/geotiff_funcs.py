import geopandas as gpd
from shapely.geometry import Point
import rasterio as rs
from rasterio.windows import from_bounds
import boto3
from botocore.config import Config
from botocore import UNSIGNED
from tqdm import tqdm
import os
from pyproj import Transformer

def find_tilecode(lat, lon):
  # assume geojson file is there
  gdf = gpd.read_file("tiles.geojson")
  pt = Point(lon, lat)
  res_tile = gdf[gdf["geometry"].contains(pt)]
  if res_tile.empty:
    print("No tile found")
    return None
  else:
    return res_tile.tile.values[0]

def s3_download(
  s3_bucket,
  s3_object_key,
  local_file_name,
  s3_client
):
  meta_data = s3_client.head_object(Bucket=s3_bucket, Key=s3_object_key)
  total_length = int(meta_data.get('ContentLength', 0))
  with tqdm(total=total_length,  desc=f'source: s3://{s3_bucket}/{s3_object_key}', bar_format="{percentage:.1f}%|{bar:25} | {rate_fmt} | {desc}",  unit='B', unit_scale=True, unit_divisor=1024) as pbar:
      with open(local_file_name, 'wb') as f:
          s3_client.download_fileobj(s3_bucket, s3_object_key, f, Callback=pbar.update)

# function to download the tilecode from aws
def download_tile(tilecode, output_file=None):
  if output_file is None:
    if not os.path.exists("chm"):
      os.makedirs("chm")
    output_file = f"chm/{tilecode}.tif"
  if os.path.exists(output_file):
    return None # file is there no need to download
  s3 = boto3.client("s3", config = Config(signature_version=UNSIGNED))
  bucket_name = "dataforgood-fb-data"
  s3_key = f"forests/v1/alsgedi_global_v6_float/chm/{tilecode}.tif"
  # s3.download_file(bucket_name, s3_key, output_file)
  s3_download(bucket_name, s3_key, output_file, s3)
  return output_file

# function to get the extents of 2km around the lat lon


# function to get the cropped array from the geotiff
def get_cropped(geotiff_file, lat, lon, degrees = 0.01):
  with rs.open(geotiff_file) as gtf:
    transformer = Transformer.from_crs("EPSG:4326", gtf.crs, always_xy=True)
    left, bottom = transformer.transform(lon - degrees, lat - (degrees / 2))
    right, top = transformer.transform(lon + degrees, lat + (degrees / 2))
    

    window = from_bounds(left, bottom, right, top, gtf.transform)

    print("====")
    print((left, bottom, right, top))
    print(window)
    print("=====")

    cropped = gtf.read(window=window)

    out_meta = gtf.meta.copy()
    out_meta.update({
      "height": window.height,
      "width": window.width,
      "transform": gtf.window_transform(window),
      # "compress": "lzw",  # Apply LZW compression
      # "tiled": True,  # Enable internal tiling
      # "blockxsize": 256,  # Optimize block size for efficiency
      # "blockysize": 256
    })
    out_file = f"{geotiff_file.split(".tif")[0]}_crop.tif"
    print(out_file)
    with rs.open(out_file, "w", **out_meta) as dest:
      dest.write(cropped)
  
LA, LO = 52.09931648242351, 5.176389871838833
GTF = "chm/120202111.tif"

