#!/usr/bin/env Rscript
#' Process FLoRA Data for Static Annotator App
#'
#' This script converts the FLoRA dataset to JSON format for the static annotator app.
#' It includes retraction status pre-merged from RetractionWatch.
#'
#' Usage: Rscript process-flora-data.R [output_dir]

library(FReD)
library(dplyr)
library(jsonlite)

# Configuration
OUTPUT_DIR <- commandArgs(trailingOnly = TRUE)[1]
if (is.na(OUTPUT_DIR)) {
  OUTPUT_DIR <- "../data"
}

cat("Processing FLoRA data for static Annotator app...\n")
cat("Output directory:", OUTPUT_DIR, "\n")

# Ensure output directory exists
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
}

# Load FReD data
cat("Loading FReD data...\n")
df <- load_fred_data(verbose = TRUE)

cat("Loaded", nrow(df), "replication records\n")

# Try to load retraction data
cat("Loading retraction data...\n")
retraction_data <- tryCatch({
  rw <- load_retractionwatch()
  rw %>%
    filter(RetractionNature == "Retraction") %>%
    select(OriginalPaperDOI) %>%
    distinct() %>%
    pull(OriginalPaperDOI) %>%
    tolower()
}, error = function(e) {
  cat("Warning: Could not load retraction data:", conditionMessage(e), "\n")
  character(0)
})

cat("Found", length(retraction_data), "retracted DOIs\n")

# Pre-compute outcomes for significance_r criterion (default for annotator)
cat("Pre-computing replication outcomes...\n")

compute_outcome <- function(es_o, n_o, es_r, n_r) {
  tryCatch({
    result <- assess_replication_outcome(
      es_o = es_o,
      n_o = n_o,
      es_r = es_r,
      n_r = n_r,
      criterion = "significance_r"
    )
    list(
      outcome = result$outcome,
      outcome_report = result$outcome_report
    )
  }, error = function(e) {
    list(outcome = NA_character_, outcome_report = NA_character_)
  })
}

# Process data
cat("Processing data...\n")

flora_df <- df %>%
  # Add retraction status
  mutate(
    doi_original_lower = tolower(doi_o),
    doi_replication_lower = tolower(doi_r),
    retracted_original = doi_original_lower %in% retraction_data,
    retracted_replication = doi_replication_lower %in% retraction_data
  ) %>%
  transmute(
    doi_original = doi_o,
    ref_original = ref_o,
    doi_replication = doi_r,
    ref_replication = ref_r,
    description,
    es_original,
    es_replication,
    n_original = n_o,
    n_replication = n_r,
    p_value_original,
    p_value_replication,
    result,
    validated = !is.na(contributors),
    osf_link = url_r,
    retracted_original,
    retracted_replication
  )

# Compute outcomes for each row
pb <- txtProgressBar(min = 0, max = nrow(flora_df), style = 3)
outcomes <- vector("list", nrow(flora_df))

for (i in seq_len(nrow(flora_df))) {
  outcomes[[i]] <- compute_outcome(
    flora_df$es_original[i],
    flora_df$n_original[i],
    flora_df$es_replication[i],
    flora_df$n_replication[i]
  )
  setTxtProgressBar(pb, i)
}
close(pb)

flora_df$computed_outcome <- sapply(outcomes, function(x) x$outcome)
flora_df$computed_outcome_report <- sapply(outcomes, function(x) x$outcome_report)

# Group by original DOI for the annotator's lookup format
cat("\nGrouping by original DOI...\n")

# Create entries grouped by original study
entries <- flora_df %>%
  filter(!is.na(doi_original)) %>%
  group_by(doi_original) %>%
  summarise(
    ref_original = first(ref_original),
    retracted_original = first(retracted_original),
    replications = list(tibble(
      doi_replication = doi_replication,
      ref_replication = ref_replication,
      description = description,
      es_original = es_original,
      es_replication = es_replication,
      n_original = n_original,
      n_replication = n_replication,
      result = result,
      computed_outcome = computed_outcome,
      computed_outcome_report = computed_outcome_report,
      validated = validated,
      osf_link = osf_link,
      retracted_replication = retracted_replication
    )),
    .groups = "drop"
  )

cat("Created", nrow(entries), "unique original study entries\n")

# Also keep entries without DOI (matched by reference)
entries_no_doi <- flora_df %>%
  filter(is.na(doi_original)) %>%
  group_by(ref_original) %>%
  summarise(
    doi_original = NA_character_,
    retracted_original = first(retracted_original),
    replications = list(tibble(
      doi_replication = doi_replication,
      ref_replication = ref_replication,
      description = description,
      es_original = es_original,
      es_replication = es_replication,
      n_original = n_original,
      n_replication = n_replication,
      result = result,
      computed_outcome = computed_outcome,
      computed_outcome_report = computed_outcome_report,
      validated = validated,
      osf_link = osf_link,
      retracted_replication = retracted_replication
    )),
    .groups = "drop"
  )

cat("Added", nrow(entries_no_doi), "entries without DOI\n")

# Success criteria metadata for annotator
success_criteria_meta <- list(
  significance_r = list(
    label = "Significance of Replication",
    hasOSNotSignificant = TRUE,
    note = "Replication success was assessed based on the statistical significance of the replication effect (and whether its direction is consistent with the original effect)."
  ),
  significance_agg = list(
    label = "Aggregated Significance",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on the aggregation of effect sizes from the original and replication studies using a meta-analytic approach."
  ),
  consistency_ci = list(
    label = "Consistency with CI",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the original effect size fell within the confidence interval of the replication effect size."
  ),
  consistency_pi = list(
    label = "Consistency with PI",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the replication effect size fell within the prediction interval derived from the original study."
  ),
  homogeneity = list(
    label = "Homogeneity",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on the homogeneity of the effects from the original and replication studies using a Q-test."
  ),
  homogeneity_significance = list(
    label = "Homogeneity & Significance",
    hasOSNotSignificant = TRUE,
    note = "Replication success was assessed based on the combination of homogeneity and the significance of the effect sizes."
  ),
  small_telescopes = list(
    label = "Small Telescopes",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the replication effect was larger than the effect size giving the original study 33% power."
  )
)

# Build final output
output <- list(
  metadata = list(
    generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
    version = packageVersion("FReD") %>% as.character(),
    entryCount = nrow(entries) + nrow(entries_no_doi),
    replicationCount = nrow(flora_df),
    retractedOriginals = sum(flora_df$retracted_original),
    retractedReplications = sum(flora_df$retracted_replication)
  ),
  entries = bind_rows(entries, entries_no_doi),
  successCriteria = success_criteria_meta,
  outcomeSymbols = list(
    success = list(html = "&#x2714;", text = "[Re]", description = "Successful replication"),
    failure = list(html = "&#x2716;", text = "[¬Re]", description = "Failed replication"),
    mixed = list(html = "&#x2753;", text = "[?Re]", description = "Mixed results"),
    os_not_significant = list(html = "&#x2754;", text = "[N/A]", description = "Original not significant"),
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
