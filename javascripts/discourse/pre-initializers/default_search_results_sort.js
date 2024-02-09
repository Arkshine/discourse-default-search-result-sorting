import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "default-search-results-sorting";

export default {
  name: PLUGIN_ID,
  before: "inject-discourse-objects",

  initializeWithApi(api) {
    /**
     * Search menu
     * -
     * Changes the default sorting.
     */
    api.modifyClass("component:search-menu/results/types", {
      pluginId: PLUGIN_ID,

      get filteredResultTypes() {
        // return only topic result types
        if (this.args.topicResultsOnly) {
          const topics = this.args.resultTypes.filter(
            (resultType) => resultType.type === "topic"
          );

          topics.firstObject.results.sort((a, b) => {
            return b.created_at > a.created_at ? 1 : -1;
          });

          return topics;
        }

        // return all result types minus topics
        return this.args.resultTypes.filter(
          (resultType) => resultType.type !== "topic"
        );
      },
    });
  },

  initialize() {
    withPluginApi("0.12.1", this.initializeWithApi);
  },
};
