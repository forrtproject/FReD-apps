#!/usr/bin/env Rscript
#' Process FReD Data for Static Explorer App
#'
#' This script converts the FReD dataset to JSON format for the static web app.
#' It pre-computes all replication outcomes for each success criterion.
#'
#' Usage: Rscript process-explorer-data.R [output_dir]

library(FReD)
library(dplyr)
library(jsonlite)

# Configuration
OUTPUT_DIR <- commandArgs(trailingOnly = TRUE)[1]
if (is.na(OUTPUT_DIR)) {
  OUTPUT_DIR <- "../data"
}

cat("Processing FReD data for static Explorer app...\n")
cat("Output directory:", OUTPUT_DIR, "\n")

# Ensure output directory exists
if (!dir.exists(OUTPUT_DIR)) {
  dir.create(OUTPUT_DIR, recursive = TRUE)
}

# Load FReD data using the package function
cat("Loading FReD data...\n")
df <- load_fred_data(verbose = TRUE)

cat("Loaded", nrow(df), "studies\n")

# Define success criteria to pre-compute
CRITERIA <- c(
  "significance_r",
  "significance_agg",
  "consistency_ci",
  "consistency_pi",
  "homogeneity",
  "homogeneity_significance",
  "small_telescopes"
)

# Pre-compute outcomes for all criteria
cat("Pre-computing replication outcomes...\n")

compute_all_outcomes <- function(row) {
  outcomes <- list()

  for (criterion in CRITERIA) {
    tryCatch({
      result <- assess_replication_outcome(
        es_o = row$es_original,
        n_o = row$n_o,
        es_r = row$es_replication,
        n_r = row$n_r,
        criterion = criterion
      )

      outcomes[[criterion]] <- list(
        outcome = result$outcome,
        outcome_detailed = result$outcome_detailed,
        outcome_report = result$outcome_report
      )
    }, error = function(e) {
      outcomes[[criterion]] <<- list(
        outcome = NA_character_,
        outcome_detailed = NA_character_,
        outcome_report = NA_character_
      )
    })
  }

  outcomes
}

# Process each row
cat("Computing outcomes for each study...\n")
pb <- txtProgressBar(min = 0, max = nrow(df), style = 3)

outcomes_list <- vector("list", nrow(df))
for (i in seq_len(nrow(df))) {
  outcomes_list[[i]] <- compute_all_outcomes(df[i, ])
  setTxtProgressBar(pb, i)
}
close(pb)

# Build the JSON structure
cat("\nBuilding JSON structure...\n")

# Select and rename columns for the static app
# Note: FReD uses ref_o, doi_o, n_o etc. for original columns
studies <- df %>%
  mutate(
    id = row_number(),
    # Keep original year if available, extract from reference if not
    orig_year_calc = if_else(
      is.na(orig_year),
      as.numeric(stringr::str_extract(ref_o, "\\b(19|20)\\d{2}\\b")),
      as.numeric(orig_year)
    ),
    # Extract journal from reference (text before year in parentheses)
    orig_journal = stringr::str_extract(ref_o, "(?<=\\. )[^.]+(?=,? \\d{4})")
  ) %>%
  transmute(
    id,
    description,
    ref_original = ref_o,
    ref_replication = ref_r,
    doi_original = doi_o,
    doi_replication = doi_r,
    es_original,
    es_replication,
    n_original = n_o,
    n_replication = n_r,
    ci_lower_original = ci.lower_original,
    ci_upper_original = ci.upper_original,
    ci_lower_replication = ci.lower_replication,
    ci_upper_replication = ci.upper_replication,
    p_value_original,
    p_value_replication,
    power_r,
    source = NA_character_,  # No dedicated source project field in current data
    orig_year = orig_year_calc,
    orig_journal,
    validated = !is.na(contributors),  # Validated if has contributors
    tags,
    osf_link = url_r,
    contributors,
    result,
    result2
  )

# Add outcomes to each study
for (i in seq_len(nrow(studies))) {
  studies$outcomes[i] <- list(outcomes_list[[i]])
  studies$reported_success[i] <- df$reported_success[i]  # Use actual reported_success field (0 NAs)
}

# Get unique sources
sources <- c("All studies", sort(unique(df$source[!is.na(df$source)])))

# Build success criteria metadata
success_criteria_meta <- list(
  significance_r = list(
    label = "Significance of Replication",
    shortLabel = "Significance (Rep)",
    hasOSNotSignificant = TRUE,
    note = "Replication success was assessed based on the statistical significance of the replication effect (and whether its direction is consistent with the original effect). Replications that were significant and in the same direction as the original were considered as successes, while replications that were not significant or in the opposite direction were considered as failures."
  ),
  significance_agg = list(
    label = "Aggregated Significance",
    shortLabel = "Aggregated Sig",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on the aggregation of effect sizes from the original and replication studies using a meta-analytic approach. Replications where the combined effect was significantly different from zero were considered as successes, while those where the combined effect was not significant were considered as failures."
  ),
  consistency_ci = list(
    label = "Consistency with CI",
    shortLabel = "Consistency (CI)",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the original effect size fell within the confidence interval of the replication effect size. Replications where the original effect size was within the confidence interval were considered as successes, while those where it was outside were considered as failures."
  ),
  consistency_pi = list(
    label = "Consistency with PI",
    shortLabel = "Consistency (PI)",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the replication effect size fell within the prediction interval derived from the original study and replication sample size. Replications within the prediction interval were considered as successes, while those outside the prediction interval were considered as failures."
  ),
  homogeneity = list(
    label = "Homogeneity",
    shortLabel = "Homogeneity",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on the homogeneity of the effects from the original and replication studies using a heterogeneity test (Q-test). Replications where the effects were homogeneous were considered as successes, while those that showed heterogeneity were considered as failures."
  ),
  homogeneity_significance = list(
    label = "Homogeneity & Significance",
    shortLabel = "Homog. & Sig",
    hasOSNotSignificant = TRUE,
    note = "Replication success was assessed based on the combination of homogeneity and the significance of the effect sizes. Replications where the effects were homogeneous and jointly significantly different from zero were considered as successes, while those that were either not homogeneous or not significantly different from zero were considered as failures."
  ),
  small_telescopes = list(
    label = "Small Telescopes",
    shortLabel = "Small Telescopes",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on whether the replication effect size was larger than the effect size that would have given the original study a power of 33%. Replications that met this criterion were considered as successes, while those that did not were considered as failures."
  ),
  reported_success = list(
    label = "Reported Success",
    shortLabel = "Reported",
    hasOSNotSignificant = FALSE,
    note = "Replication success was assessed based on the outcome reported in the replication study itself. This uses the pre-coded 'result' field from the FReD database."
  )
)

# Outcome colors
outcome_colors <- list(
  success = "#8FBC8F",
  Success = "#8FBC8F",
  failure = "#FF7F7F",
  Failure = "#FF7F7F",
  `failure (reversal)` = "darkred",
  `Failure (reversal)` = "darkred",
  `OS not significant` = "#D3D3D3",
  `Not calculable` = "#C8C8C8",
  `not calculable` = "#C8C8C8",
  `success (homogeneous and jointly significantly above 0)` = "#8FBC8F",
  `failure (not homogeneous but jointly significantly above 0)` = "#efa986",
  `failure (not homogeneous and not significant)` = "darkred",
  `failure (homogeneous but not significant)` = "#FF7F7F"
)

# Build final output
output <- list(
  metadata = list(
    generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ"),
    version = packageVersion("FReD") %>% as.character(),
    studyCount = nrow(studies),
    sourceCount = length(sources) - 1  # Exclude "All studies"
  ),
  studies = studies,
  sources = sources,
  successCriteria = success_criteria_meta,
  outcomeColors = outcome_colors
)

# Write JSON
output_file <- file.path(OUTPUT_DIR, "explorer-data.json")
cat("Writing JSON to:", output_file, "\n")

# Convert to JSON with proper formatting
json_output <- toJSON(
  output,
  auto_unbox = TRUE,
  na = "null",
  null = "null",
  pretty = FALSE,  # Compact for smaller file size
  digits = 6
)

writeLines(json_output, output_file)

# Report file size
file_size <- file.info(output_file)$size
cat("Output file size:", format(file_size, big.mark = ","), "bytes\n")
cat("Done!\n")
