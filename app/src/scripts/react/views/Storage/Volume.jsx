// ZFS POOL / VOLUME ITEM
// ======================
// Individual item which represents a ZFS pool and its associated volume.
// Contains the datasets, ZVOLs, and other high level objects that are
// properties of the pool.

"use strict";

import React from "react";
import TWBS from "react-bootstrap";

import ByteCalc from "../../../utility/ByteCalc";
import BreakdownChart from "./Volumes/BreakdownChart";
import PoolDatasets from "./Volumes/PoolDatasets";
import PoolTopology from "./Volumes/PoolTopology";

const SLIDE_DURATION = 500;
const NAV_STATES = new Set( [ "disks", "filesystem", "snapshots", "files" ] );

const Volume = React.createClass(
  { displayName: "Volume"

  , propTypes:
    { handleDiskAdd          : React.PropTypes.func.isRequired
    , handleDiskRemove       : React.PropTypes.func.isRequired
    , handleVdevAdd          : React.PropTypes.func.isRequired
    , handleVdevRemove       : React.PropTypes.func.isRequired
    , handleVdevTypeChange   : React.PropTypes.func.isRequired
    , handleVolumeReset      : React.PropTypes.func.isRequired
    , handleVolumeNameChange : React.PropTypes.func.isRequired
    , submitVolume           : React.PropTypes.func.isRequired
    , availableDisks         : React.PropTypes.array.isRequired
    , availableSSDs          : React.PropTypes.array.isRequired
    , existsOnRemote         : React.PropTypes.bool
    , data                   : React.PropTypes.array
    , logs                   : React.PropTypes.array
    , cache                  : React.PropTypes.array
    , spares                 : React.PropTypes.array
    , free: React.PropTypes.oneOfType(
        [ React.PropTypes.string
        , React.PropTypes.number
        ]
      )
    , allocated: React.PropTypes.oneOfType(
        [ React.PropTypes.string
        , React.PropTypes.number
        ]
      )
    , size: React.PropTypes.oneOfType(
        [ React.PropTypes.string
        , React.PropTypes.number
        ]
      )
    , datasets        : React.PropTypes.array
    , name            : React.PropTypes.string
    , volumeKey       : React.PropTypes.number.isRequired
    }

  , getDefaultProps: function () {
      return { existsOnRemote : false
             , data           : []
             , logs           : []
             , cache          : []
             , spares         : []
             , free           : 0
             , allocated      : 0
             , size           : 0
             };
    }

  , returnInitialStateValues: function () {
      return { activeSection   : null
             , editing         : false
             , data            : this.props.data
             , logs            : this.props.logs
             , cache           : this.props.cache
             , spares          : this.props.spares
             , free            : this.props.free
             , allocated       : this.props.allocated
             , size            : this.props.size
             };
    }

  // The editing reconciliation model for Volume relies on the difference
  // between state and props. As with a simple form, the intial values are set
  // by props. Subsequent modifications to these occur in state, until an
  // update task is performed, at which time the new props will be assigned, and
  // each mutable value in state is exactly equal to its counterpart in props.
  // This pattern is also used to compare user-submitted values to upstream
  // changes. In componentWillUpdate, if we can see that the current props and
  // state have the same value for a given key, we can update the entry in the
  // client's representation without conflict. In the case that these values are
  // unequal, we can choose instead to display a warning, indicate that another
  // user has modified that field, etc. As always, the last change "wins".
  , getInitialState: function () {
      return this.returnInitialStateValues();
    }

  // A shorthand method used to "cancel" creation or editing of a volume.
  // TODO: This should probably be gated so that it isn't triggered without a
  // warning to the user.
  , resetToInitialState: function () {
      this.setState( this.returnInitialStateValues() );
    }

  , componentDidUpdate: function ( prevProps, prevState ) {
      let sectionIsVisible       = Boolean( prevState["activeSection"] );
      let sectionShouldBeVisible = Boolean( this.state["activeSection"] );

      // Toggle the display of the content drawer
      if ( sectionIsVisible !== sectionShouldBeVisible ) {
        if ( sectionShouldBeVisible ) {
          Velocity( React.findDOMNode( this.refs.drawer )
                  , "slideDown"
                  , SLIDE_DURATION
                  );
        } else {
          Velocity( React.findDOMNode( this.refs.drawer )
                  , "slideUp"
                  , SLIDE_DURATION
                  );
        }
      }
    }

  , enterEditMode: function () {
      this.setState({ editing: true });
    }

  , handlePanelOpen: function () {
      this.setState({ activeSection: "disks" });
    }

  , handleNavSelect: function ( keyName ) {
      if ( NAV_STATES.has( keyName ) ) {
        this.setState({ activeSection: keyName });
      } else {
        this.setState({ activeSection: null });
      }
    }

  , createVolumeName: function () {
      if ( this.state.editing ) {
        return (
          <div className="volume-name-input">
            <TWBS.Input
              type = "text"
              onChange = { this.props.handleVolumeNameChange
                               .bind( null, this.props.volumeKey )
                         }
              placeholder = "Volume Name"
              value       = { this.props.name }
            />
          </div>
        );
      } else {
        return (
          <h3 className="pull-left volume-name">{ this.props.name }</h3>
        );
      }
    }

  , createDrawerContent: function () {
      switch ( this.state.activeSection ) {
        case "disks":
          return (
            <PoolTopology
              availableDisks       = { this.props.availableDisks }
              availableSSDs        = { this.props.availableSSDs }
              handleDiskAdd        = { this.props.handleDiskAdd }
              handleDiskRemove     = { this.props.handleDiskRemove }
              handleVdevAdd        = { this.props.handleVdevAdd }
              handleVdevRemove     = { this.props.handleVdevRemove }
              handleVdevTypeChange = { this.props.handleVdevTypeChange }
              data                 = { this.state.data }
              logs                 = { this.state.logs }
              cache                = { this.state.cache }
              spares               = { this.state.spares }
              volumeKey            = { this.props.volumeKey }
              volumesOnServer      = { this.props.volumesOnServer }
            />
          );
          break;
        case "filesystem":
          return (
            <PoolDatasets ref="Storage" />
          );
          break;
      }
    }

  , render: function () {
      let isInitialized = !this.props.existsOnRemote && !this.state.editing;

      let initMessage = null;
      let volumeInfo  = null;
      let breakdown   = null;
      let drawer      = null;

      if ( isInitialized ) {
        // We can deduce that this Volume is the "blank" one, and that it has
        // not yet been interacted with. We use this state information to
        // display an initialization message.

        initMessage = (
          <div className="text-center">
            <TWBS.Button
              bsStyle = "primary"
              onClick = { this.enterEditMode }
            >
            { "Create new ZFS volume" }
            </TWBS.Button>
          </div>
        );
      } else {
        let freeSize      = ByteCalc.convertString( this.props.free );
        let allocatedSize = ByteCalc.convertString( this.props.allocated );
        let totalSize     = ByteCalc.convertString( this.props.size );

        volumeInfo = (
          <div className="volume-info clearfix">
            { this.createVolumeName() }
            <h3 className="pull-right volume-capacity">
              { ByteCalc.humanize( totalSize ) }
            </h3>
          </div>
        );

        breakdown = (
          <BreakdownChart
            free   = { freeSize }
            used   = { allocatedSize }
            parity = { totalSize / 4 /* FIXME */ }
            total  = { totalSize }
          />
        );

        drawer = (
          <div
            ref     = "drawer"
            style   = {{ display: "none" }}
            onClick = { function ( event ) { event.stopPropagation(); } }
          >
            <TWBS.Nav
              className = "volume-nav"
              bsStyle   = "pills"
              activeKey = { this.state.activeSection }
              onSelect  = { this.handleNavSelect }
            >
              <TWBS.NavItem eventKey="disks">
                {"Disks"}
              </TWBS.NavItem>
              <TWBS.NavItem eventKey="filesystem">
                {"Filesystem"}
              </TWBS.NavItem>
              {/* <TWBS.NavItem>Snapshots</TWBS.NavItem> */}
              {/* <TWBS.NavItem>Files</TWBS.NavItem> */}
            </TWBS.Nav>
            { this.createDrawerContent() }
          </div>
        );
      }

      return (
        <TWBS.Panel
          className = { "volume" + ( isInitialized ? " awaiting-init" : "" ) }
          onClick   = { this.handlePanelOpen }
        >
          { initMessage }
          { volumeInfo }
          { breakdown }
          { drawer }
        </TWBS.Panel>
      );
    }

  }
);

export default Volume;
