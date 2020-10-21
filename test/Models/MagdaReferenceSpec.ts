import { runInAction } from "mobx";
import CatalogGroup from "../../lib/Models/CatalogGroupNew";
import CatalogMemberFactory from "../../lib/Models/CatalogMemberFactory";
import CommonStrata from "../../lib/Models/CommonStrata";
import CsvCatalogItem from "../../lib/Models/CsvCatalogItem";
import GeoJsonCatalogItem from "../../lib/Models/GeoJsonCatalogItem";
import MagdaReference from "../../lib/Models/MagdaReference";
import RootCatalogGroup from "../../lib/Models/RootCatalogGroup";
import Terria from "../../lib/Models/Terria";
import StubCatalogItem from "../../lib/Models/StubCatalogItem";
import { BaseModel } from "../../lib/Models/Model";

describe("MagdaReference", function() {
  const recordGroupWithOneCsv = {
    id: "test-group",
    name: "Test Group",
    aspects: {
      group: {
        members: [
          {
            id: "thing-in-group",
            name: "A thing in the group",
            aspects: {
              terria: {
                type: "csv",
                definition: {
                  url: "some.csv"
                }
              }
            }
          }
        ]
      }
    }
  };
  const recordRootGroup = {
    id: "test-group",
    name: "Test Group",
    aspects: {
      group: recordGroupWithOneCsv.aspects.group,
      "terria-init": {
        corsDomains: ["a.b.c", "d.e.f"]
      },
      "terria-config": {
        parameters: { mochi: "neko" }
      }
    }
  };

  it("dereferences to a root group if there are map-config related aspects", function(done) {
    const terria = new Terria();
    const originalIdFromMagda = "some-magda-defined-id";

    const model = new MagdaReference(originalIdFromMagda, terria);
    model.setTrait(CommonStrata.definition, "recordId", originalIdFromMagda);
    model.setTrait(CommonStrata.definition, "magdaRecord", recordRootGroup);

    model
      .loadReference()
      .then(() => {
        expect(model.target instanceof RootCatalogGroup).toBe(true);
        const group = model.target as RootCatalogGroup;
        expect(group.isOpen).toBe(false);
        expect(group.members.length).toEqual(1);

        // target should be the rootgroupid
        expect(group.uniqueId).toEqual(RootCatalogGroup.rootGroupId);
        expect(group.uniqueId).not.toEqual(originalIdFromMagda);
        // however we should still be able to look at the reference via the ID..
        expect(model.uniqueId).toEqual(originalIdFromMagda);
      })
      .then(done)
      .catch(done.fail);
  });

  it("can dereference to a group", function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );

    model
      .loadReference()
      .then(() => {
        expect(model.target instanceof CatalogGroup).toBe(true);
        const group = model.target as CatalogGroup;
        expect(group.isOpen).toBe(false);
      })
      .then(done)
      .catch(done.fail);
  });

  it("dereferenced group contains expected item", function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );

    model
      .loadReference()
      .then(() => {
        const group = model.target as CatalogGroup;
        expect(group.members.length).toBe(1);
        expect(group.members[0]).toBe(
          recordGroupWithOneCsv.aspects.group.members[0].id
        );
        expect(group.memberModels.length).toBe(1);
        expect(group.memberModels[0] instanceof CsvCatalogItem).toBe(true);
      })
      .then(done)
      .catch(done.fail);
  });

  it("definition trait can override traits of dereferenced member", function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );
    model.setTrait(CommonStrata.definition, "override", {
      isOpen: true
    });

    model
      .loadReference()
      .then(() => {
        const group = model.target as CatalogGroup;
        expect(group.isOpen).toBe(true);
      })
      .then(done)
      .catch(done.fail);
  });

  it("override trait can override traits of the members of a dereferenced group", function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );
    model.setTrait(CommonStrata.definition, "override", {
      members: [
        {
          id: "thing-in-group",
          type: "csv",
          url: "somethingelse.csv"
        }
      ]
    });

    model
      .loadReference()
      .then(() => {
        const group = model.target as CatalogGroup;
        const csv = group.memberModels[0] as CsvCatalogItem;
        expect(csv.url).toBe("somethingelse.csv");
      })
      .then(done)
      .catch(done.fail);
  });

  it("changes to override trait affect members of a dereferenced group", async function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );
    model.setTrait(CommonStrata.definition, "override", {
      members: [
        {
          id: "thing-in-group",
          type: "csv",
          url: "first.csv"
        }
      ]
    });

    Promise.resolve()
      .then(async () => {
        await model.loadReference();

        const group = model.target as CatalogGroup;
        const csv = group.memberModels[0] as CsvCatalogItem;
        expect(csv.url).toBe("first.csv");

        runInAction(() => {
          const override: any = model.getTrait(
            CommonStrata.definition,
            "override"
          );
          override.members[0].url = "second.csv";
        });

        await model.loadReference();

        const group2 = model.target as CatalogGroup;
        const csv2 = group2.memberModels[0] as CsvCatalogItem;
        expect(csv2.url).toBe("second.csv");
      })
      .then(done)
      .catch(done.fail);
  });

  it("changes to Magda record affect members of a dereferenced group", async function(done) {
    const terria = new Terria();

    const model = new MagdaReference(undefined, terria);
    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(
      CommonStrata.definition,
      "magdaRecord",
      recordGroupWithOneCsv
    );
    model.setTrait(CommonStrata.definition, "override", {
      members: [
        {
          id: "thing-in-group",
          type: "csv",
          url: "first.csv"
        }
      ]
    });

    Promise.resolve()
      .then(async () => {
        await model.loadReference();

        const group = model.target as CatalogGroup;
        const csv = group.memberModels[0] as CsvCatalogItem;
        expect(csv.name).toContain("A thing");

        runInAction(() => {
          const magdaRecord: any = model.getTrait(
            CommonStrata.definition,
            "magdaRecord"
          );
          magdaRecord.aspects.group.members[0].name = "!!!";
        });

        await model.loadReference();

        const group2 = model.target as CatalogGroup;
        const csv2 = group2.memberModels[0] as CsvCatalogItem;
        expect(csv2.name).toBe("!!!");
      })
      .then(done)
      .catch(done.fail);
  });

  it("loads valid items and ignores broken items", async function() {
    const groupWithBrokenItem: any = {
      aspects: {
        group: {
          members: [
            {
              aspects: {
                terria: {
                  definition: {
                    name: "GeoJSON Another Test",
                    url: "http://ci.terria.io/master/test/bike_racks.geojson"
                  },
                  id: "fa0e6775-e285-4f49-8d5a-abd58cbfdfad",
                  type: "geojson"
                }
              },
              id: "fa0e6775-e285-4f49-8d5a-abd58cbfdfad",
              name: "GeoJSON Another Test"
            },
            {
              aspects: {
                terria: {
                  definition: {
                    name: "GeoJSON Another Test with broken url",
                    url: null
                  },
                  id: "1057cfde-243b-4aa0-8bba-732f45327c96",
                  type: "geojson"
                }
              },
              id: "1057cfde-243b-4aa0-8bba-732f45327c96",
              name: "GeoJSON Another Test with broken url"
            },
            {
              aspects: {
                terria: {
                  definition: {}
                },
                id: "item-with-no-type-and-definition",
                type: "unknown"
              },
              id: "item-with-no-type-and-definition",
              name: "item with no type and definition"
            }
          ]
        },
        terria: {
          definition: {
            description: "New empty catalog group",
            name: "Contains broken stuff"
          },
          id: "c0f03092-d7e8-4ff0-9edd-72393b256960",
          type: "group"
        }
      },
      id: "c0f03092-d7e8-4ff0-9edd-72393b256960",
      name: "Contains broken stuff",
      tenantId: 0
    };

    const terria = new Terria();
    const model = new MagdaReference(undefined, terria);

    model.setTrait(CommonStrata.definition, "recordId", "test-group");
    model.setTrait(CommonStrata.definition, "magdaRecord", groupWithBrokenItem);

    await model.loadReference();

    const group = model.target as CatalogGroup;
    expect(group.members.length).toBe(3);

    const member0 = group.memberModels[0] as GeoJsonCatalogItem;
    expect(member0.uniqueId).toBe("fa0e6775-e285-4f49-8d5a-abd58cbfdfad");
    expect(member0.type).toBe(GeoJsonCatalogItem.type);
    expect(member0.isExperiencingIssues).toBe(false);

    const member1 = group.memberModels[1] as GeoJsonCatalogItem;
    expect(member1.uniqueId).toBe("1057cfde-243b-4aa0-8bba-732f45327c96");
    expect(member1.type).toBe(GeoJsonCatalogItem.type);
    expect(member1.isExperiencingIssues).toBe(true);

    const unknown = group.memberModels[2] as MagdaReference;
    expect(unknown.uniqueId).toBe("item-with-no-type-and-definition");
    expect(unknown.name).toBe("item with no type and definition");
    expect(unknown.type).toBe("magda");
    expect(unknown.target).toBeUndefined();
  });
});
