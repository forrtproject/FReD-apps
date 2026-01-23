#!/usr/bin/env Rscript
#' Process FLoRA Data for Static Annotator App
#'
#' This script downloads the FLoRA CSV from FReD-data repo and converts it to JSON
#' for the static annotator app.
#'
#' Usage: Rscript process-flora-data.R [output_dir]

library(dplyr)
library(jsonlite)
library(readr)

# Configuration
OUTPUT_DIR <- commandArgs(trailingOnly = TRUE)[1]
if (is.na(OUTPUT_DIR)) {
  OUTPUT_DIR <- "../data"
}

FLORA_URL <- "https://raw.githubusercontent.com/forrtproject/FReD-data/refs/heads/main/output/flora.csv"

cat("Processing FLoRA data for static Annotator app...\n")
cat("Output directory:", OUTPUT_DIR, "\n")

# Ensure output directory exists
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
}

# Download and load FLoRA data
cat("Downloading FLoRA data from:", FLORA_URL, "\n")
flora_df <- read_csv(FLORA_URL, show_col_types = FALSE)

cat("Loaded", nrow(flora_df), "replication records\n")

# Process data - keep it simple, matching the CSV structure
cat("Processing data...\n")

flora_processed <- flora_df %>%
  transmute(
    doi_original = doi_o,
    ref_original = apa_ref_o,
    title_original = title_o,
    journal_original = journal_o,
    year_original = year_o,
    doi_replication = doi_r,
    ref_replication = apa_ref_r,
    title_replication = title_r,
    journal_replication = journal_r,
    year_replication = year_r,
    url_replication = url_r,
    outcome = outcome,
    outcome_quote = outcome_quote,
    study_type = type
  )

# Group by original DOI for the annotator's lookup format
cat("Grouping by original DOI...\n")

entries <- flora_processed %>%
  filter(!is.na(doi_original) & doi_original != "") %>%
  group_by(doi_original) %>%
  summarise(
    ref_original = first(ref_original),
    title_original = first(title_original),
    journal_original = first(journal_original),
    year_original = first(year_original),
    replications = list(tibble(
      doi_replication = doi_replication,
      ref_replication = ref_replication,
      title_replication = title_replication,
      journal_replication = journal_replication,
      year_replication = year_replication,
      url_replication = url_replication,
      outcome = outcome,
      outcome_quote = outcome_quote,
      study_type = study_type
    )),
    .groups = "drop"
  )

cat("Created", nrow(entries), "unique original study entries\n")

# Count outcomes for summary
outcome_counts <- flora_processed %>%
  count(outcome) %>%
  arrange(desc(n))

cat("Outcome distribution:\n")
print(outcome_counts)

# Build final output
output <- list(
  metadata = list(
    generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
    source = FLORA_URL,
    entryCount = nrow(entries),
    replicationCount = nrow(flora_processed)
  ),
  entries = entries,
  outcomeSymbols = list(
    success = list(html = "&#x2714;", text = "[Re]", description = "Successful replication"),
    failure = list(html = "&#x2716;", text = "[¬Re]", description = "Failed replication"),
    mixed = list(html = "&#x2753;", text = "[?Re]", description = "Mixed results"),
    informative = list(html = "&#x2139;", text = "[i]", description = "Informative failure signal"),
    inconclusive = list(html = "&#x2754;", text = "[?]", description = "Inconclusive"),
    not_coded = list(html = "&#x270F;", text = "[NC]", description = "Not yet coded")
  )
)

# Write JSON
output_file <- file.path(OUTPUT_DIR, "flora-data.json")
cat("Writing JSON to:", output_file, "\n")

json_output <- toJSON(
  output,
  auto_unbox = TRUE,
  na = "null",
  null = "null",
  pretty = FALSE,
  digits = 6
)

writeLines(json_output, output_file)

# Report file size
file_size <- file.info(output_file)$size
cat("Output file size:", format(file_size, big.mark = ","), "bytes\n")
cat("Done!\n")
