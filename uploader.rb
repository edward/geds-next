require "csv"
require "json"
require "httpclient"
require 'logger'

$logger = Logger.new(STDOUT)

CSV_FILE = "data/gedsOpenData-cleaned.csv"

class SwiftypePoster
  SWIFTYPE_AUTH_TOKEN = "YOUR TOKEN"
  SWIFTYPE_POST_URI = "https://api.swiftype.com/api/v1/engines/public-service-staff-directory/document_types/people/documents/bulk_create"

  def initialize(csv_file, start_at, end_at)
    @start_at = start_at
    @end_at = end_at
    @csv_file = csv_file
  end

  def run
    docs = eat_csv

    json = {auth_token: SWIFTYPE_AUTH_TOKEN,
            documents: docs}.to_json

    File.open("data/docfile.json", "w+") do |file|
      file << json
    end

    post_everything(json)
  end

  private

  def eat_csv
    counter = 0
    docs = []
    CSV.foreach(CSV_FILE, headers: true) do |person|
      if counter >= @start_at
        docs << doc = to_swiftype_doc(person, counter)
        logger.info "Prepared doc #{counter}"
      end

      return docs if counter > @end_at
              
      counter += 1
    end
    docs
  end

  def post_everything(json)
    uri = URI(SWIFTYPE_POST_URI)

    client = HTTPClient.new
    client.debug_dev = STDOUT
    response = client.post(uri, json, {'Content-Type' => 'application/json'})
  end

  private

  def logger
    $logger
  end

  def to_swiftype_doc(person, counter)
    field_type =->(type) do
      case type
      when "Department Acronym", "Department Name (EN)", "Department Name (FR)", "Street Address (EN)",
           "Street Address (FR)", "Country (EN)",
           "Country (FR)",
           "Province (EN)",
           "Province (FR)",
           "City (EN)",
           "City (FR)",
           "Postal Code",
           "PO Box (EN)",
           "PO Box (FR)",
           "Mailstop",
           "Building (EN)",
           "Building (FR)",
           "Floor",
           "Room"
        "enum"
      else
        "string"
      end
    end

    fields = person.headers.map do |header|
      {name: header, value: person[header], type: field_type.call(header)}
    end

    {external_id: counter,
     fields: fields }
  end
end

s = SwiftypePoster.new(CSV_FILE, 0, 170000)
s.run